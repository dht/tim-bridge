import "dotenv/config";
import fs from "fs-extra";
import path from "path";
import { clearLogs, logCrash, registerCrashHandlers } from "tim-logger/server";
import { getMachineConfig } from "./configs.js";
import { logDevice } from "./device.js";
import { startHttpServer } from "./express.js";
import { initFirebase, listenToCollection } from "./firestore.js";
import { getLogger } from "./globals.js";
import { getIp } from "./ip.js";
import { initLogger } from "./logger.js";
import { machinesInfoDev } from "./machines.js";
import { setStatus } from "./rgb/rgb.js";

const LISTEN_TO_ALL = process.env.LISTEN_TO_ALL === "true";
const MACHINE_ID = process.env.MACHINE_ID;
const CLIENT_ID = process.env.CLIENT_ID;
let lastServerStatus, lastBridgeStatus;

initFirebase();

const packageJsonPath = path.resolve("./package.json");

const logger = initLogger(CLIENT_ID);

if (LISTEN_TO_ALL) {
  await logger.clearLogs();
}

// Track unsubscribe fns if listenToCollection returns them
const unsubscribers = new Map();

registerCrashHandlers();
startHttpServer();

async function startMachine(id) {
  const logger = getLogger();
  const cfg = getMachineConfig(id);
  if (!cfg) return;

  const ip = await getIp();

  const { callbacks, predicate, collection } = cfg;

  logger.info(`🎧 Machine ID: ${id} (collection: "${collection}")`);

  // If onStart throws, fail that machine without taking down all
  try {
    callbacks.onStartBridge(id, { ip });
  } catch (err) {
    logCrash(`onStart failed for ${id}`, err);
    return;
  }

  const unsubscribe = listenToCollection(collection, (change) => {
    const { serverStatus, bridgeStatus } = change;

    // Only react to this machine
    if (change?.id !== id) return;

    // Optional predicate filter
    if (predicate && !predicate(change)) return;

    try {
      if (serverStatus === "GENERATING" && serverStatus !== lastServerStatus) {
        callbacks.onGenerating(id, change);
      }

      if (bridgeStatus === "IDLE" && bridgeStatus !== lastBridgeStatus) {
        callbacks.onIdle(id, change);
      }

      callbacks.onChange(id, change);

      lastBridgeStatus = bridgeStatus;
      lastServerStatus = serverStatus;
    } catch (err) {
      logger.error(`onChange failed for ${id}`, err);
    }
  });

  // Support optional unsubscribe return
  if (typeof unsubscribe === "function") {
    unsubscribers.set(id, unsubscribe);
  }
}

async function cleanupAndExit(code = 0) {
  const logger = getLogger();
  try {
    logger.info("Cleaning up before exit...");

    const ids = LISTEN_TO_ALL
      ? Object.keys(machinesInfoDev)
      : [MACHINE_ID].filter(Boolean);

    // Stop firestore listeners first (if supported)
    for (const id of ids) {
      const unsub = unsubscribers.get(id);
      if (typeof unsub === "function") {
        try {
          unsub();
        } catch (err) {
          logger.error(`Unsubscribe failed for ${id}`, err);
        }
      }
    }

    // Call onEnd for each machine
    for (const id of ids) {
      const cfg = getMachineConfig(id);
      if (!cfg) continue;

      try {
        const ip = await getIp();
        await cfg.callbacks.onCloseBridge(id, { ip });
      } catch (err) {
        logger.error(`onEnd failed for ${id}`, err);
      }
    }
  } finally {
    process.exit(code);
  }
}

process.on("SIGINT", () => cleanupAndExit(0));
process.on("SIGTERM", () => cleanupAndExit(0));

async function run() {
  const logger = getLogger();
  clearLogs();
  const pkg = await fs.readJson(packageJsonPath);
  const ip = await getIp();

  logger.info(`=== TIM BRIDGE v${pkg.version} STARTING ===`);
  logger.info(`IP Address: ${ip || "not found"}`);

  if (LISTEN_TO_ALL) {
    logger.warn("⚠️  Listening to ALL machines");
  } else {
    if (!MACHINE_ID) {
      logger.error("Missing env MACHINE_ID (and LISTEN_TO_ALL is not true).");
      return cleanupAndExit(1);
    }
    logger.info(`🎧 Listening to machine: ${MACHINE_ID}`);
  }

  setStatus("1.IDLE");
  logDevice();

  if (LISTEN_TO_ALL) {
    for (const machineId of Object.keys(machinesInfoDev)) {
      await startMachine(machineId);
    }
    return;
  }

  await startMachine(MACHINE_ID);
}

run().catch((err) => {
  logCrash("Fatal run() error", err);
  cleanupAndExit(1);
});

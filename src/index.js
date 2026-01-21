import "dotenv/config";
import fs from "fs-extra";
import path from "path";
import { getMachineConfig } from "./configs.js";
import { logDevice } from "./device.js";
import { listenToCollection } from "./firestore.js";
import { getIp } from "./ip.js";
import { clearLog, log, logCrash, registerCrashHandlers } from "./log.js";
import { machinesInfo } from "./machines.js";
import { setStatus } from "./rgb/rgb.js";

const LISTEN_TO_ALL = process.env.LISTEN_TO_ALL === "true";
const MACHINE_ID = process.env.MACHINE_ID;

const packageJsonPath = path.resolve("./package.json");

// Track unsubscribe fns if listenToCollection returns them
const unsubscribers = new Map();

registerCrashHandlers();

async function startMachine(id) {
  const cfg = getMachineConfig(id);
  if (!cfg) return;

  const ip = await getIp();

  const { callbacks, predicate, collection } = cfg;

  log.info(`🎧 Machine ID: ${id} (collection: "${collection}")`);

  // If onStart throws, fail that machine without taking down all
  try {
    callbacks.onStart(id, { ip });
  } catch (err) {
    logCrash(`onStart failed for ${id}`, err);
    return;
  }

  const unsubscribe = listenToCollection(collection, (change) => {
    // Only react to this machine
    if (change?.id !== id) return;

    // Optional predicate filter
    if (predicate && !predicate(change)) return;

    try {
      callbacks.onChange(id, change);
    } catch (err) {
      logCrash(`onChange failed for ${id}`, err);
    }
  });

  // Support optional unsubscribe return
  if (typeof unsubscribe === "function") {
    unsubscribers.set(id, unsubscribe);
  }
}

async function cleanupAndExit(code = 0) {
  try {
    log.info("Cleaning up before exit...");

    const ids = LISTEN_TO_ALL
      ? Object.keys(machinesInfo)
      : [MACHINE_ID].filter(Boolean);

    // Stop firestore listeners first (if supported)
    for (const id of ids) {
      const unsub = unsubscribers.get(id);
      if (typeof unsub === "function") {
        try {
          unsub();
        } catch (err) {
          logCrash(`Unsubscribe failed for ${id}`, err);
        }
      }
    }

    // Call onEnd for each machine
    for (const id of ids) {
      const cfg = getMachineConfig(id);
      if (!cfg) continue;

      try {
        const ip = await getIp();
        await cfg.callbacks.onEnd(id, { ip });
      } catch (err) {
        logCrash(`onEnd failed for ${id}`, err);
      }
    }
  } finally {
    process.exit(code);
  }
}

process.on("SIGINT", () => cleanupAndExit(0));
process.on("SIGTERM", () => cleanupAndExit(0));

async function run() {
  clearLog();
  const pkg = await fs.readJson(packageJsonPath);
  const ip = await getIp();

  log.info(`=== TIM BRIDGE v${pkg.version} STARTING ===`);
  log.info(`IP Address: ${ip || "not found"}`);

  if (LISTEN_TO_ALL) {
    log.warn("⚠️  Listening to ALL machines");
  } else {
    if (!MACHINE_ID) {
      log.error("Missing env MACHINE_ID (and LISTEN_TO_ALL is not true).");
      return cleanupAndExit(1);
    }
    log.info(`🎧 Listening to machine: ${MACHINE_ID}`);
  }

  setStatus("1.IDLE");
  logDevice();

  if (LISTEN_TO_ALL) {
    for (const machineId of Object.keys(machinesInfo)) {
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

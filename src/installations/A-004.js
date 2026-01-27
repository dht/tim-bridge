// A-004 is robotic arm

import { applyPose } from "../arm/pose.js";
import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { init, shutdown as shutdownServos } from "../servos.js";
import { getRestTimeline, startPlaybackFromTimelineUrl } from "../timeline.js";

let lastValues = {};

init();

export async function onStartBridge(id, data) {
  const logger = getLogger();
  const updateMachine = updateMachineCreator(id);
  const { ip } = data;

  logger.info(`${id} onStartBridge`, { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onIdle(id, data) {
  const idleTimeline = getRestTimeline(id);

  const isDev = id.includes("-dev");

  startPlaybackFromTimelineUrl(
    id,
    idleTimeline,
    { isDev },
    {
      loop: true,
      allowExternal: true,
    },
  );
}

export async function onGenerating(id, data) {}

export function onChange(id, ev) {
  const logger = getLogger();
  const data = ev.data;

  // If isActive flag is present, control servo power here
  if (typeof data.isActive === "boolean") {
    if (data.isActive === false) {
      logger.info(`${id}: isActive=false — shutting down servos (no power)`);
      try {
        shutdownServos();
      } catch (err) {
        logger.error(`${id}: error shutting down servos:`, err);
      }
      return;
    } else {
      // ensure servos are initialized/powered when active
      try {
        init();
      } catch (err) {
        logger.error(`${id}: error initializing servos:`, err);
      }
    }
  }

  const {
    isActive,
    base,
    shoulder,
    elbow,
    wristPitch,
    wristRoll,
    gripperOpen,
  } = data;
  logger.info({
    isActive,
    base,
    shoulder,
    elbow,
    wristPitch,
    wristRoll,
    gripperOpen,
  });

  lastValues = applyPose(
    { base, shoulder, elbow, wristPitch, wristRoll, gripperOpen },
    { lastPose: lastValues },
  );
}

export async function onCloseBridge(id, data) {
  const logger = getLogger();
  logger.info(`${id} onCloseBridge`);

  const updateMachine = updateMachineCreator(id);

  return updateMachine({
    bridgeIp: "",
    bridgeStatus: "OFFLINE",
    isBridgeOnline: false,
  });
}

export const lifecycle = {
  onStartBridge,
  onIdle,
  onChange,
  onGenerating,
  onCloseBridge,
};

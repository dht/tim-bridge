// A-004 is robotic arm

import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { applyPose } from "../arm/pose.js";
import { init, shutdown as shutdownServos } from "../servos.js";

let lastValues = {};

init();

export async function onStart(id, data) {
  const logger = getLogger();
  const updateMachine = updateMachineCreator(id);
  const { ip } = data;

  logger.info(`${id} onStart`, { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

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

export async function onEnd(id, data) {
  const logger = getLogger();
  logger.info(`${id} onEnd`);

  const updateMachine = updateMachineCreator(id);

  return updateMachine({
    bridgeIp: "",
    bridgeStatus: "OFFLINE",
    isBridgeOnline: false,
  });
}

export const lifecycle = {
  onStart,
  onChange,
  onEnd,
};

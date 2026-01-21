// A-003 is robotic arm

import { updateMachineCreator } from "../firestore.js";
import { log } from "../log.js";
import { init, moveToAngle, shutdown as shutdownServos } from "../servos.js";

let lastValues = {};

init();

export async function onStart(id, data) {
  const updateMachine = updateMachineCreator(id);
  const { ip } = data;

  log.info("A-003 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export function onChange(_id, ev) {
  const data = ev.data;
  log.info("A-003 onChange called");
  log.info("A-003 onChange data:", data);
  // If isActive flag is present, control servo power here
  if (typeof data.isActive === "boolean") {
    if (data.isActive === false) {
      log.info("A-003: isActive=false — shutting down servos (no power)");
      try {
        shutdownServos();
      } catch (err) {
        log.error("A-003: error shutting down servos:", err);
      }
      return;
    } else {
      // ensure servos are initialized/powered when active
      try {
        init();
      } catch (err) {
        log.error("A-003: error initializing servos:", err);
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
  log.info({
    isActive,
    base,
    shoulder,
    elbow,
    wristPitch,
    wristRoll,
    gripperOpen,
  });

  if (lastValues.base !== base) {
    moveToAngle(1, base);
    lastValues.base = base;
  }
  if (lastValues.shoulder !== shoulder) {
    moveToAngle(2, shoulder);
    lastValues.shoulder = shoulder;
  }
  if (lastValues.elbow !== elbow) {
    moveToAngle(3, elbow);
    lastValues.elbow = elbow;
  }
  if (lastValues.wristPitch !== wristPitch) {
    moveToAngle(4, wristPitch);
    lastValues.wristPitch = wristPitch;
  }
  if (lastValues.wristRoll !== wristRoll) {
    moveToAngle(5, wristRoll);
    lastValues.wristRoll = wristRoll;
  }
  if (lastValues.gripperOpen !== gripperOpen) {
    moveToAngle(6, gripperOpen);
    lastValues.gripperOpen = gripperOpen;
  }

  lastValues = { ...data };

  // Log each value on every change
  log.info("A-003 onChange values:");
  log.info("  base:", lastValues.base);
  log.info("  shoulder:", lastValues.shoulder);
  log.info("  elbow:", lastValues.elbow);
  log.info("  wristPitch:", lastValues.wristPitch);
  log.info("  wristRoll:", lastValues.wristRoll);
  log.info("  gripperOpen:", lastValues.gripperOpen);
}

export async function onEnd(id, data) {
  log.info("A-003 onEnd");

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

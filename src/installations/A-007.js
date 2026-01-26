// Coffee Shop

import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { setStatus } from "../rgb/rgb.js";

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

// haiku
export async function onChange(id, ev) {
  const logger = getLogger();
  const data = ev.data;
  const { status } = data;

  if (status) {
    logger.info(`${id} LED status: ${status}`);
    setStatus(status);
  }

  logger.info(`${id} ✅ Playback + Lights completed.`);
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

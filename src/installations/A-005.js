import { updateMachineCreator } from "../firestore.js";
import { log } from "../log.js";
import { setStatus } from "../rgb/rgb.js";

export async function onStart(id, data) {
  const updateMachine = updateMachineCreator(id);
  const { ip } = data;

  log.info("A-005 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

// haiku
export async function onChange(_id, ev) {
  const data = ev.data;
  const { status } = data;

  if (status) {
    log.info("A-005 LED status:", status);
    setStatus(status);
  }

  log.info("A-005 ✅ Playback + Lights completed.");
}

export async function onEnd(id, data) {
  log.info("A-005 onEnd");

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

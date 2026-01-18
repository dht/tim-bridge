import { updateMachineCreator } from "../firestore.js";
import { log } from "../log.js";
import { setStatus } from "../rgb/rgb.js";

const updateMachine = updateMachineCreator("A-005");

export async function onStart(data) {
  const { ip } = data;

  log.info("A-005 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

// haiku
export async function onChange(ev) {
  const data = ev.data;
  const { status } = data;

  if (status) {
    log.info("A-005 LED status:", status);
    setStatus(status);
  }

  log.info("A-005 ✅ Playback + Lights completed.");
}

export async function onEnd(data) {
  log.info("A-005 onEnd");

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

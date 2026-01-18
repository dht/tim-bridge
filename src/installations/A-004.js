import { updateMachineCreator } from "../firestore.js";
import { log } from "../log.js";
import { setStatus } from "../rgb/rgb.js";

const updateMachine = updateMachineCreator("A-004");

export async function onStart(data) {
  const { ip } = data;

  log.info("A-004 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

// candle
export async function onChange(ev) {
  const data = ev.data;
  const { status } = data;

  if (status) {
    log.info("A-004 LED status:", status);
    setStatus(status);
  }

  log.info("A-004 ✅ Playback + Lights completed.");
}

export async function onEnd(data) {
  log.info("A-004 onEnd");
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

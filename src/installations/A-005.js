import { updateMachineCreator } from "../firestore.js";

const updateMachine = updateMachineCreator("A-005");

export async function onStart(data) {
  const { ip } = data;

  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

// haiku
export async function onChange(data) {
  const { status } = data;

  if (status) {
    console.log("LED status:", status);
    setStatus(status);
  }

  console.log("✅ Playback + Lights completed.");
}

export async function onEnd(data) {
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

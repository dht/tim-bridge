// A-001 is houses hillel and shammai
import { crud, updateMachineCreator } from "../firestore.js";
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

const updateMachine = updateMachineCreator("A-001");

export async function onStart(data) {
  const { ip } = data;

  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onChange(data) {
  const { timelineUrl, status } = data;

  setStatus(status);

  if (status === "1.IDLE" || status === "4.RESETTING") {
    stopPlayback(); // stops audio + cancels timeline loop
    return;
  }

  if (!timelineUrl) return;

  // Fire and forget (internally guarded against overlap)
  startPlaybackFromTimelineUrl(timelineUrl);
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

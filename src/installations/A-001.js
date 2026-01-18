// A-001 is houses hillel and shammai
import { updateMachineCreator } from "../firestore.js";
import { log } from "../log.js";
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

const updateMachine = updateMachineCreator("A-001");

export async function onStart(data) {
  const { ip } = data;

  log.info("A-001 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onChange(ev) {
  const { timelineUrl, status } = ev.data;

  log.info("A-001 onChange", {
    status,
    hasTimelineUrl: Boolean(timelineUrl),
  });

  setStatus(status);

  if (status === "1.IDLE" || status === "4.RESETTING") {
    stopPlayback(); // stops audio + cancels timeline loop
    return;
  }

  if (!timelineUrl) return;

  // Fire and forget (internally guarded against overlap)

  startPlaybackFromTimelineUrl("A-001", timelineUrl);
}

export async function onEnd(data) {
  log.info("A-001 onEnd");
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

// A-001 is houses hillel and shammai
import { updateMachineCreator } from "../firestore.js";
import { checkIsDevHost } from "../ip.js";
import { log } from "../log.js";
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

export async function onStart(id, data) {
  const { ip } = data;
  const updateMachine = updateMachineCreator(id);

  log.info("A-001 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onChange(_id, ev) {
  const { timelineUrl, status, originWebpageUrl } = ev.data;

  const isDev = checkIsDevHost(originWebpageUrl);

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

  startPlaybackFromTimelineUrl("A-001", timelineUrl, {
    isDev,
    originWebpageUrl,
  });
}

export async function onEnd(id, data) {
  log.info("A-001 onEnd");

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

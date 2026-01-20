// 2084
import { updateMachineCreator } from "../firestore.js";
import { checkIsDevHost } from "../ip.js";
import { log } from "../log.js";
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

const updateMachine = updateMachineCreator("A-002");

export async function onStart(data) {
  const { ip } = data;

  log.info("A-002 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onChange(ev) {
  const { timelineUrl, status, originWebpageUrl } = ev.data;

  const isDev = checkIsDevHost(originWebpageUrl);

  log.info("A-002 onChange", {
    status,
    hasTimelineUrl: Boolean(timelineUrl),
  });
  if (status) setStatus(status);

  if (status === "1.IDLE") {
    stopPlayback(); // stops audio + cancels timeline loop
    return;
  }

  if (!timelineUrl) return;

  // Fire and forget (internally guarded against overlap)
  startPlaybackFromTimelineUrl("A-002", timelineUrl, {
    isDev,
    originWebpageUrl,
  });
}

export async function onEnd(data) {
  log.info("A-002 onEnd");
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

// A-001 is houses hillel and shammai
import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { checkIsDevHost } from "../ip.js";
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

const REST_TIMELINE =
  "https://storage.googleapis.com/tim-os.firebasestorage.app/A-001-dev/_timeline.json";

export async function onStart(id, data) {
  const logger = getLogger();

  const { ip } = data;
  const updateMachine = updateMachineCreator(id);

  logger.info("A-001 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onChange(id, ev) {
  const logger = getLogger();
  const { timelineUrl, status, originWebpageUrl } = ev.data;

  const isDev = checkIsDevHost(originWebpageUrl);

  logger.info(`${id} onChange`, {
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

  startPlaybackFromTimelineUrl(id, timelineUrl, {
    isDev,
    originWebpageUrl,
  });
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

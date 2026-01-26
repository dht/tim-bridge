// 2084 - Retro TV Futuristic news Audio and Picture (A-002)

import { closeRetroTv, openRetroTvUrl } from "../retrotv.js";
import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { checkIsDevHost } from "../ip.js";
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function onStart(id, data) {
  const logger = getLogger();
  const updateMachine = updateMachineCreator(id);
  const { ip } = data;

  logger.info("A-002 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });

  const url = `https://tim-os.web.app/${id}/edge/tv`;

  logger.info("A-002 restart RetroTV Chromium", { url });
  closeRetroTv();
  await sleep(750);
  openRetroTvUrl(url, { kiosk: true, app: false });
}

export async function onChange(id, ev) {
  const logger = getLogger();
  const { timelineUrl, status, originWebpageUrl } = ev.data;

  const isDev = checkIsDevHost(originWebpageUrl);

  logger.info(`${id} onChange`, {
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

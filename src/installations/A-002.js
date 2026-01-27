// 2084 - Retro TV Futuristic news Audio and Picture (A-002)

import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { checkIsDevHost } from "../ip.js";
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

const getRestTimeline = (id) =>
  `https://storage.googleapis.com/tim-os.firebasestorage.app/${id}/_timeline.rest.json`;
const getGeneratingTimeline = (id) =>
  `https://storage.googleapis.com/tim-os.firebasestorage.app/${id}/_timeline.generating.json`;

let activeMode = null;

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
  // closeRetroTv();
  await sleep(750);
  // openRetroTvUrl(url, { kiosk: true, app: false });
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

  const restTimeline = getRestTimeline(id);
  const generatingTimeline = getGeneratingTimeline(id);

  let desiredMode = null;
  if (status === "1.IDLE") desiredMode = "rest";
  if (status === "2a.GENERATING") desiredMode = "generating";
  if (status === "3a.PLAYBACK") desiredMode = "playback";

  if (status === "4.RESETTING" || status === "3b.DONE" || status === "0.ERROR") {
    desiredMode = null;
  }

  if (desiredMode !== activeMode) {
    stopPlayback();
    activeMode = desiredMode;
  }

  if (!activeMode) return;

  if (activeMode === "rest") {
    startPlaybackFromTimelineUrl(id, restTimeline, { isDev, originWebpageUrl }, {
      loop: true,
      allowExternal: true,
      bridgeStatus: "IDLE-CYCLE",
    });
    return;
  }

  if (activeMode === "generating") {
    startPlaybackFromTimelineUrl(id, generatingTimeline, { isDev, originWebpageUrl }, {
      loop: true,
      allowExternal: true,
      bridgeStatus: "GENERATING",
    });
    return;
  }

  if (!timelineUrl) return;

  startPlaybackFromTimelineUrl(id, timelineUrl, { isDev, originWebpageUrl }, { allowExternal: true });
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

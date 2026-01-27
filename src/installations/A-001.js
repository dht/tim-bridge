// A-001 is houses hillel and shammai
import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { checkIsDevHost } from "../ip.js";
import { setStatus } from "../rgb/rgb.js";
import {
  getRestTimeline,
  startPlaybackFromTimelineUrl,
  stopPlayback,
} from "../timeline.js";

export async function onStartBridge(id, data) {
  const logger = getLogger();

  const { ip } = data;
  const updateMachine = updateMachineCreator(id);

  logger.info("A-001 onStart", { ip });

  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });

  onIdle(id, data);
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

export async function onGenerating(id, data) {
  const restTimeline = getRestTimeline(id);

  const isDev = id.includes("-dev");

  startPlaybackFromTimelineUrl(
    id,
    restTimeline,
    { isDev },
    {
      loop: true,
      allowExternal: true,
    },
  );
}

export async function onIdle(id, data) {
  const idleTimeline = getRestTimeline(id);

  const isDev = id.includes("-dev");

  startPlaybackFromTimelineUrl(
    id,
    idleTimeline,
    { isDev },
    {
      loop: true,
      allowExternal: true,
    },
  );
}

export async function onCloseBridge(id, data) {
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
  onStartBridge,
  onIdle,
  onChange,
  onGenerating,
  onCloseBridge,
};

// Daily Haiku Station

import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { setStatus } from "../rgb/rgb.js";
import { getRestTimeline, startPlaybackFromTimelineUrl } from "../timeline.js";

export async function onStartBridge(id, data) {
  const logger = getLogger();
  const updateMachine = updateMachineCreator(id);
  const { ip } = data;

  logger.info(`${id} onStartBridge`, { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
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

export async function onGenerating(id, data) {}

// haiku
export async function onChange(id, ev) {
  const logger = getLogger();
  const data = ev.data;
  const { status } = data;

  if (status) {
    logger.info(`${id} LED status: ${status}`);
    setStatus(status);
  }

  logger.info(`${id} ✅ Playback + Lights completed.`);
}

export async function onCloseBridge(id, data) {
  const logger = getLogger();
  logger.info(`${id} onCloseBridge`);

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

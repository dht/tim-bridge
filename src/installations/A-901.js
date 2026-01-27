// 901 = Claygon / talking statues
// A-901: open browser in a normal window when GENERATING,
// close when RESETTING or ANY other status

import { closeBrowser, closeBrowserDelayed, openBrowser } from "../browser.js";
import { updateMachineCreator } from "../firestore.js";
import { getLogger } from "../globals.js";
import { getRestTimeline, startPlaybackFromTimelineUrl } from "../timeline.js";

const MAX_SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes

let lastStatus = null;

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

export async function onChange(id, ev) {
  const logger = getLogger();
  const data = ev.data;
  const { status, params } = data;

  logger.info(`${id} onChange`, { status, params });
  if (!status) return;

  switch (status) {
    case "3b.DONE":
    case "4.RESETTING":
    case "1.IDLE":
      logger.info(`${id} closing browser for status:`, status);
      closeBrowser();
      break;
    case "3a.PLAYBACK":
      // closeBrowser();
      // delay (500)
      const URL = `https://tim-os.web.app/${id}}/edge/running`;

      logger.info(`${id} opening browser for playback`);
      openBrowser(URL + "?language=" + (params?.language || "en"));
      closeBrowserDelayed(MAX_SESSION_DURATION_MS);
      break;
  }

  lastStatus = status;
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

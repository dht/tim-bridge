// 901 = Claygon / talking statues
// A-901: open browser in a normal window when GENERATING,
// close when RESETTING or ANY other status

import { closeBrowser, closeBrowserDelayed, openBrowser } from "../browser.js";
import { updateMachineCreator } from "../firestore.js";
import { log } from "../log.js";

const MAX_SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes

let lastStatus = null;

const URL = "https://tim-os.web.app/A-901/edge/running";

const updateMachine = updateMachineCreator("A-901");

export async function onStart(data) {
  const { ip } = data;

  log.info("A-901 onStart", { ip });
  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onChange(ev) {
  const data = ev.data;
  const { status, params } = data;

  log.info("A-901 onChange", { status, params });
  if (!status) return;

  switch (status) {
    case "3b.DONE":
    case "4.RESETTING":
    case "1.IDLE":
      log.info("A-901 closing browser for status:", status);
      closeBrowser();
      break;
    case "3a.PLAYBACK":
      // closeBrowser();
      // delay (500)
      log.info("A-901 opening browser for playback");
      openBrowser(URL + "?language=" + (params?.language || "en"));
      closeBrowserDelayed(MAX_SESSION_DURATION_MS);
      break;
  }

  lastStatus = status;
}

export async function onEnd(data) {
  log.info("A-901 onEnd");
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

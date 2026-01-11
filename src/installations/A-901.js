// 901 = Claygon / talking statues
// A-901: open browser in a normal window when GENERATING,
// close when RESETTING or ANY other status

import { closeBrowser, closeBrowserDelayed, openBrowser } from "../browser.js";
import { updateMachineCreator } from "../firestore.js";

const MAX_SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes

let lastStatus = null;

const URL = "https://tim-os.web.app/A-901/edge/running";

const updateMachine = updateMachineCreator("A-901");

export async function onStart(data) {
  const { ip } = data;

  updateMachine({
    bridgeIp: ip,
    bridgeStatus: "IDLE",
    isBridgeOnline: true,
  });
}

export async function onChange(data) {
  const { status, params } = data;

  if (!status) return;

  switch (status) {
    case "3b.DONE":
    case "4.RESETTING":
    case "1.IDLE":
      closeBrowser();
      break;
    case "3a.PLAYBACK":
      // closeBrowser();
      // delay (500)
      openBrowser(URL + "?language=" + (params?.language || "en"));
      closeBrowserDelayed(MAX_SESSION_DURATION_MS);
      break;
  }

  lastStatus = status;
}

export async function onEnd(data) {
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

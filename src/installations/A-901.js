// A-901: open browser in a normal window when GENERATING,
// close when RESETTING or ANY other status

import { closeBrowser, openBrowser } from "../browser.js";

let lastStatus = null;

const URL = "https://tim-os.web.app/A-901/edge/running";

export async function onChange(data) {
  const { status } = data;
  if (!status) return;

  console.log(status);

  if (status === "3a.PLAYBACK") {
    openBrowser(URL);
  }

  if (lastStatus === "3a.PLAYBACK") {
    switch (status) {
      case "3b.DONE":
        console.log("Playback completed naturally.");
        closeBrowser();
        break;
      case "4.RESETTING":
        console.log("Playback stopped manually.");
        closeBrowser();
        break;
    }
  }

  lastStatus = status;
}

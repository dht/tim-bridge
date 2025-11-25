// A-901: open Chromium in a normal window when GENERATING, close when RESETTING

import { spawn } from "node:child_process";

let browser = null;
const URL = "https://tim-os.web.app/A-901/edge/running";
const BROWSER_CMD = "chromium";  // Bookworm binary name

function openBrowser() {
  if (browser && !browser.killed) {
    console.log("Chromium already running.");
    return;
  }

  console.log("Opening Chromium (normal window)…");

  browser = spawn(
    BROWSER_CMD,
    [
      "--noerrdialogs",
      "--disable-infobars",
      "--disable-session-crashed-bubble",
      URL,
    ],
    {
      stdio: "ignore",
      detached: true,
    }
  );

  browser.unref();
}

function closeBrowser() {
  console.log("Closing Chromium…");

  try {
    spawn("pkill", ["-f", BROWSER_CMD], { stdio: "ignore" });
  } catch (err) {
    console.error("Failed to close Chromium:", err);
  }

  browser = null;
}

export async function onChange(data) {
  const { status } = data;
  if (!status) return;

  console.log("A-901 status:", status);

  if (status === "GENERATING") {
    openBrowser();
  }

  if (status === "RESETTING") {
    closeBrowser();
  }
}

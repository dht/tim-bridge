// A-901: open Chromium in a normal window when GENERATING, close when RESETTING or ANY other status

import { spawn } from 'node:child_process';

let browser = null;
let lastStatus = null; // <-- Track previous status

const URL = 'https://tim-os.web.app/A-901/edge/running';
const BROWSER_CMD = 'chromium'; // Bookworm binary name

function openBrowser() {
  if (browser && !browser.killed) {
    console.log('Chromium already running.');
    return;
  }

  console.log('Opening Chromium (normal window)…');

  browser = spawn(
    BROWSER_CMD,
    ['--noerrdialogs', '--disable-infobars', '--disable-session-crashed-bubble', URL],
    {
      stdio: 'ignore',
      detached: true,
    }
  );

  browser.unref();
}

function closeBrowser() {
  console.log('Closing Chromium…');

  try {
    spawn('pkill', ['-f', BROWSER_CMD], { stdio: 'ignore' });
  } catch (err) {
    console.error('Failed to close Chromium:', err);
  }

  browser = null;
}

export async function onChange(data) {
  const { status } = data;
  if (!status) return;

  console.log('A-901 status:', status, '(last:', lastStatus, ')');

  // --- NEW LOGIC ---
  // If previous state was GENERATING and it changes to ANYTHING else → close Chromium
  if (lastStatus === 'GENERATING' && status !== 'GENERATING') {
    closeBrowser();
  }
  // ------------------

  if (status === 'GENERATING') {
    openBrowser();
  }

  lastStatus = status; // <- Update previous status
}

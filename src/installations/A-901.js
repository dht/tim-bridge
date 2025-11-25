// A-901: Chromium opener (works with screen or without)

import { spawn } from 'node:child_process';

let browser = null;
let resetTimer = null;

const URL = 'https://tim-os.web.app/A-901/edge/running';
const AUTO_RESET_MS = 5 * 60 * 1000; // 5 minutes

// Detect if a screen is available (HDMI plugged in or virtual screen)
function hasDisplay() {
  // DISPLAY is set if X11 is available
  return !!process.env.DISPLAY;
}

function startAutoReset() {
  clearAutoReset();
  resetTimer = setTimeout(() => {
    console.log('⏱️ Auto-reset timeout reached. Closing Chromium...');
    closeBrowser();
  }, AUTO_RESET_MS);
}

function clearAutoReset() {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
}

function openBrowser() {
  if (browser && !browser.killed) {
    console.log('Chromium already open. Refreshing timer.');
    startAutoReset();
    return;
  }

  const hasScreen = hasDisplay();

  console.log(`Opening Chromium in ${hasScreen ? 'NORMAL (screen)' : 'HEADLESS'} mode`);

  const args = hasScreen
    ? [
        '--noerrdialogs',
        '--disable-session-crashed-bubble',
        '--disable-infobars',
        '--kiosk',
        '--start-fullscreen',
        URL,
      ]
    : ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9222', URL];

  browser = spawn('chromium', args, {
    stdio: 'ignore',
    detached: true,
    env: {
      ...process.env,
      // ensures browser runs even without UI session
      DISPLAY: hasScreen ? process.env.DISPLAY : undefined,
    },
  });

  browser.unref();

  startAutoReset();
}

function closeBrowser() {
  console.log('Closing Chromium…');
  try {
    spawn('pkill', ['-f', 'chromium'], { stdio: 'ignore' });
  } catch (err) {
    console.error('Failed to close Chromium:', err);
  }
  browser = null;
  clearAutoReset();
}

export async function onChange(data) {
  const { status } = data;

  if (!status) return;
  console.log('A-901 received status:', status);

  if (status === 'GENERATING') {
    openBrowser();
    return;
  }

  if (status === 'RESETTING') {
    closeBrowser();
    return;
  }

  // Any other status: refresh the reset timer if browser is open
  if (browser) {
    console.log('Status changed; refreshing auto-reset timer.');
    startAutoReset();
  }
}

// browser.js
// Shared helpers to open/close the A-901 browser window.

import { spawn } from 'node:child_process';
import { identifyDevice } from './device.js';

let browserOpen = false; // Track whether we *think* the browser is open

// Devices we expect from identifyDevice():
// - "pi-zero-1", "pi-zero-2", "pi-4", "pi-5", "mac"

function getBrowserConfig() {
  const info = identifyDevice();
  const device = info.device;

  // Default: all Raspberry Pi variants (Bookworm)
  // chromium binary is usually "chromium" on Bookworm
  let openCmd = 'chromium';
  let openArgs = url => [
    '--noerrdialogs',
    '--disable-infobars',
    '--disable-session-crashed-bubble',
    url,
  ];
  let killCmd = 'pkill';
  let killArgs = ['-f', 'chromium'];

  if (device === 'mac') {
    // On macOS use Firefox
    // Correct 'open' syntax is:
    // open -a "Firefox" <url> --args <chrome-args...>
    openCmd = 'open';
    openArgs = url => [
      '-a',
      'Firefox',
      url,
      '--args',
      '--noerrdialogs',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
    ];

    // Prefer a clean AppleScript quit over pkill
    killCmd = 'osascript';
    killArgs = ['-e', 'tell application "Firefox" to quit'];
  }

  return { openCmd, openArgs, killCmd, killArgs, device };
}

/**
 * Open the browser to the given URL.
 *
 * @param {string} url - URL to open.
 * @param {object} [options]
 * @param {boolean} [options.force=false] - If true, ignore the browserOpen flag and always try to open.
 */
export function openBrowser(url, { force = false } = {}) {
  if (browserOpen && !force) {
    console.log('Browser already marked as running.');
    return;
  }

  const { openCmd, openArgs, device } = getBrowserConfig();
  const args = openArgs(url);

  console.log(`Opening browser (normal window)… [device=${device}]`);
  console.log(`Command: ${openCmd} ${args.join(' ')}`);

  try {
    const child = spawn(openCmd, args, {
      stdio: 'ignore',
      detached: true,
    });

    // Important: many spawn failures are emitted as 'error' on the child,
    // not thrown synchronously.
    child.on('error', err => {
      console.error('Failed to spawn browser process:', err);
    });

    // We do not rely on the child process lifetime (especially on macOS),
    // we just mark it as "open" after spawning.
    child.unref();
    browserOpen = true;
  } catch (err) {
    console.error('Failed to open browser (synchronous error):', err);
  }
}

export function closeBrowser() {
  console.log('closeBrowser called');

  if (!browserOpen) {
    console.log('Browser already marked as closed.');
    return;
  }

  const { killCmd, killArgs, device } = getBrowserConfig();

  console.log(`Closing browser… [device=${device}]`);
  console.log(`Command: ${killCmd} ${killArgs.join(' ')}`);

  try {
    const child = spawn(killCmd, killArgs, { stdio: 'ignore', detached: true });

    child.on('error', err => {
      console.error('Failed to spawn browser-kill process:', err);
    });

    child.unref();
  } catch (err) {
    console.error('Failed to close browser (synchronous error):', err);
  }

  // We mark it closed from our perspective, even if the OS-level kill fails.
  browserOpen = false;
}

const timeoutClose = null;

export function closeBrowserDelayed(delayMs) {
  if (!delayMs) return;

  if (timeoutClose) {
    clearTimeout(timeoutClose);
  }

  timeoutClose = setTimeout(() => {
    closeBrowser();
  }, delayMs);
}

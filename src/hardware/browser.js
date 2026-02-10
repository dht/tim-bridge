// browser.js
// Raspberry Pi–first Chromium controller (single-tab, no relaunch)

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import WebSocket from 'ws';
import { identifyDevice } from '../utils/device.js';

/**
 * Find Chromium binary safely.
 */
function findChromiumBinary() {
  const candidates = [
    'chromium',
    'chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (const cmd of candidates) {
    const res = spawnSync('which', [cmd], { stdio: 'ignore' });
    if (res.status === 0) return cmd;
  }

  throw new Error('Chromium binary not found');
}

/**
 * Detect Chromium process.
 */
function isBrowserRunning() {
  const res = spawnSync('pgrep', ['-f', 'chromium'], { stdio: 'ignore' });
  return res.status === 0;
}

/**
 * Browser config.
 */
function getBrowserConfig() {
  const { device } = identifyDevice();

  // Raspberry Pi / Linux
  let openCmd = findChromiumBinary();
  let openArgs = (url) => [
    '--noerrdialogs',
    '--disable-infobars',
    '--disable-session-crashed-bubble',
    '--disable-restore-session-state',
    '--no-first-run',
    '--remote-debugging-port=9222',
    url,
  ];

  let killCmd = 'pkill';
  let killArgs = ['-f', 'chromium'];

  // macOS (dev only)
  if (device === 'mac') {
    openCmd = 'open';
    openArgs = (url) => ['-a', 'Firefox', url];
    killCmd = 'osascript';
    killArgs = ['-e', 'tell application "Firefox" to quit'];
  }

  return { openCmd, openArgs, killCmd, killArgs, device };
}

/**
 * GUI env safety (systemd / SSH).
 */
function buildGuiEnv(env) {
  if (process.platform !== 'linux') return env;

  const nextEnv = { ...env };

  if (!nextEnv.DISPLAY) nextEnv.DISPLAY = ':0';

  if (!nextEnv.XAUTHORITY && nextEnv.HOME) {
    const xauth = `${nextEnv.HOME}/.Xauthority`;
    if (fs.existsSync(xauth)) nextEnv.XAUTHORITY = xauth;
  }

  if (!nextEnv.DBUS_SESSION_BUS_ADDRESS && process.getuid) {
    const bus = `/run/user/${process.getuid()}/bus`;
    if (fs.existsSync(bus)) {
      nextEnv.DBUS_SESSION_BUS_ADDRESS = `unix:path=${bus}`;
    }
  }

  return nextEnv;
}

/**
 * Public entry.
 */
export function applyBrowser(fieldId, value) {
  if (fieldId === 'browserUrl') {
    openOrUpdateBrowser(value);
  }
}

/**
 * Open or reuse Chromium.
 */
export function openOrUpdateBrowser(url) {
  const nextUrl = url || 'about:blank';

  if (isBrowserRunning()) {
    updateBrowserUrl(nextUrl);
    return;
  }

  openBrowser(nextUrl);
}

/**
 * DevTools flow (Pi-safe):
 * - POST /json/new
 * - Close all other tabs
 * - Activate remaining tab
 */
export async function updateBrowserUrl(url) {
  try {
    // 1. Create new tab
    const newTab = await devtoolsJsonPUT('/json/new');

    // 2. Navigate via WebSocket
    await navigateViaWebSocket(newTab, url);

    // 3. Close all other tabs
    const targets = await devtoolsJsonGET('/json');
    for (const t of targets) {
      if (t.type === 'page' && t.id !== newTab.id) {
        await devtoolsRequest(`/json/close/${t.id}`);
      }
    }

    // 4. Activate
    await devtoolsRequest(`/json/activate/${newTab.id}`);

  } catch (err) {
    console.error('Failed to update browser URL:', err);
  }
}

async function navigateViaWebSocket(target, url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Page.navigate',
        params: { url },
      }));
    });

    ws.on('message', () => {
      ws.close();
      resolve();
    });

    ws.on('error', reject);
  });
}

/**
 * DevTools GET JSON helper.
 */
function devtoolsJsonGET(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:9222${path}`, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from ${path}: ${data.slice(0, 80)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * DevTools PUT JSON helper.
 */
function devtoolsJsonPUT(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:9222${path}`,
      { method: 'PUT' },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from PUT ${path}: ${data.slice(0, 80)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

/**
 * DevTools fire-and-forget.
 */
function devtoolsRequest(path) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:9222${path}`, () => resolve());
  });
}

/**
 * Open Chromium.
 */
export function openBrowser(url) {
  const { openCmd, openArgs, device } = getBrowserConfig();
  const args = openArgs(url);

  console.log(`Opening browser… [${device}]`);
  console.log(`${openCmd} ${args.join(' ')}`);

  const child = spawn(openCmd, args, {
    stdio: 'ignore',
    detached: true,
    env: buildGuiEnv(process.env),
  });

  child.unref();
}

/**
 * Close Chromium.
 */
export function closeBrowser() {
  const { killCmd, killArgs, device } = getBrowserConfig();

  console.log(`Closing browser… [${device}]`);

  const child = spawn(killCmd, killArgs, {
    stdio: 'ignore',
    detached: true,
    env: buildGuiEnv(process.env),
  });

  child.unref();
}

let closeTimer = null;

/**
 * Close browser after delay.
 */
export function closeBrowserDelayed(delayMs) {
  if (!delayMs) return;

  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(closeBrowser, delayMs);
}

// browser.mac.js
// macOS Chrome/Chromium controller (single-tab, no relaunch)

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const OFFLINE_MODE = false;

function findBrowserBinary() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    `${os.homedir()}/Applications/Chromium.app/Contents/MacOS/Chromium`,
    'google-chrome',
    'chromium',
    'chromium-browser',
  ];

  for (const candidate of candidates) {
    if (candidate.startsWith('/')) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }

    const res = spawnSync('which', [candidate], { stdio: 'ignore' });
    if (res.status === 0) return candidate;
  }

  throw new Error('Chrome/Chromium binary not found');
}

function isBrowserRunning() {
  const res = spawnSync('pgrep', ['-f', 'Google Chrome|Chromium'], { stdio: 'ignore' });
  return res.status === 0;
}

function getBrowserConfig() {
  const profileDir = path.join(os.tmpdir(), 'tim-bridge-chromium-profile');

  const openCmd = findBrowserBinary();
  const openArgs = (url) => [
    '--kiosk',
    '--start-fullscreen',
    '--start-maximized',
    '--noerrdialogs',
    '--disable-infobars',
    '--disable-session-crashed-bubble',
    '--disable-restore-session-state',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,InfiniteSessionRestore',
    `--user-data-dir=${profileDir}`,
    '--remote-debugging-port=9222',
    url,
  ];

  const killCmd = 'pkill';
  const killArgs = ['-f', 'Google Chrome|Chromium'];

  return { openCmd, openArgs, killCmd, killArgs, profileDir };
}

function buildGuiEnv(env) {
  return env;
}

export function applyBrowser(fieldId, value) {
  if (fieldId === 'browserUrl') {
    openOrUpdateBrowser(value);
  }
}

export function openOrUpdateBrowser(url) {
  const nextUrl = url || 'about:blank';

  if (isBrowserRunning()) {
    updateBrowserUrl(nextUrl);
    return;
  }

  openBrowser(nextUrl);
}

export async function updateBrowserUrl(url) {
  try {
    const newTab = await devtoolsJsonPUT('/json/new');

    await navigateViaWebSocket(newTab, url);

    const targets = await devtoolsJsonGET('/json');
    for (const t of targets) {
      if (t.type === 'page' && t.id !== newTab.id) {
        await devtoolsRequest(`/json/close/${t.id}`);
      }
    }

    await devtoolsRequest(`/json/activate/${newTab.id}`);
  } catch (err) {
    console.error('Failed to update browser URL:', err);
  }
}

async function navigateViaWebSocket(target, url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Page.navigate',
          params: { url },
        })
      );
    });

    ws.on('message', () => {
      ws.close();
      resolve();
    });

    ws.on('error', reject);
  });
}

function devtoolsJsonGET(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:9222${path}`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from ${path}: ${data.slice(0, 80)}`));
          }
        });
      })
      .on('error', reject);
  });
}

function devtoolsJsonPUT(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:9222${path}`, { method: 'PUT' }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from PUT ${path}: ${data.slice(0, 80)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function devtoolsRequest(path) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:9222${path}`, () => resolve());
  });
}

export function openBrowser(url) {
  const { openCmd, openArgs, profileDir } = getBrowserConfig();
  const args = openArgs(url);

  if (profileDir) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      fs.mkdirSync(profileDir, { recursive: true });
    } catch (err) {
      console.warn(`Failed to reset browser profile dir "${profileDir}":`, err);
    }
  }

  console.log('Opening browser… [mac]');
  console.log(`${openCmd} ${args.join(' ')}`);

  const child = spawn(openCmd, args, {
    stdio: 'ignore',
    detached: true,
    env: buildGuiEnv(process.env),
  });

  child.unref();
}

export function closeBrowser() {
  const { killCmd, killArgs } = getBrowserConfig();

  console.log('Closing browser… [mac]');

  const child = spawn(killCmd, killArgs, {
    stdio: 'ignore',
    detached: true,
    env: buildGuiEnv(process.env),
  });

  child.unref();
}

let closeTimer = null;

export function closeBrowserDelayed(delayMs) {
  if (!delayMs) return;

  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(closeBrowser, delayMs);
}

function toOfflineCacheImagePath(rawValue, machineId = '') {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return '';

  const withoutHash = trimmed.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];

  if (withoutQuery.startsWith('/cache/')) return withoutQuery;
  if (withoutQuery.startsWith('./cache/')) return withoutQuery.replace(/^\./, '');
  if (withoutQuery.startsWith('cache/')) return `/${withoutQuery}`;

  const storageMatch = withoutQuery.match(/\/([^/]+)\/sessions\/([^/]+)\/([^/]+)$/);
  if (storageMatch) {
    const [, machineFromUrl, sessionId, fileName] = storageMatch;
    const nextMachineId = machineId || machineFromUrl;
    return `/cache/${nextMachineId}/${sessionId}/${fileName}`;
  }

  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const sessionsIndex = parts.indexOf('sessions');

    if (sessionsIndex >= 1 && parts.length > sessionsIndex + 2) {
      const machineFromUrl = parts[sessionsIndex - 1];
      const sessionId = parts[sessionsIndex + 1];
      const fileName = parts[sessionsIndex + 2];
      const nextMachineId = machineId || machineFromUrl;
      return `/cache/${nextMachineId}/${sessionId}/${fileName}`;
    }
  } catch {
    // Keep original value when URL parsing fails.
  }

  return withoutQuery;
}

export function changeToImageInBrowser(fieldId, value, meta = {}) {
  const { machineId = '' } = meta;
  const imageValue = OFFLINE_MODE ? toOfflineCacheImagePath(value, machineId) : String(value || '');
  const hash = new URLSearchParams({
    image: imageValue,
    ...(OFFLINE_MODE ? { offline: '1' } : {}),
  }).toString();
  const url = `http://localhost:3000/#${hash}`;
  openOrUpdateBrowser(url);
}

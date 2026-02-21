import { execFile as execFileCb, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { crud } from '../utils/firestore.js';
import { LAUNCHER_ORDER_TYPES, isLauncherOrderType, normalizeOrderType } from './order-types.js';

const execFile = promisify(execFileCb);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LAUNCHER_BASH_DIR = path.join(PROJECT_ROOT, 'launcher', 'bash');

const DEFAULT_PM2_APP_NAME = process.env.PM2_APP_NAME || 'houses';
const FINAL_STATUSES = new Set(['RUNNING', 'DONE', 'ERROR', 'SCHEDULED']);
const LOG_LIMIT = 20_000;

function nowTs() {
  return Date.now();
}

function truncateText(value = '', max = LOG_LIMIT) {
  const text = String(value || '');

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max)}\n...<truncated>`;
}

function formatError(err) {
  if (!err) {
    return 'Unknown launcher error';
  }

  if (typeof err === 'string') {
    return err;
  }

  return truncateText(err.stderr || err.message || JSON.stringify(err));
}

function parseJsonLoose(input) {
  if (typeof input !== 'string') {
    return input;
  }

  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function getPm2AppName(order = {}) {
  const { pm2AppName } = order;
  const payload = parseJsonLoose(order.payload) || {};
  const fallback = payload.pm2AppName || payload.appName;

  return String(pm2AppName || fallback || DEFAULT_PM2_APP_NAME).trim();
}

function getOrderValues(order = {}) {
  const payload = parseJsonLoose(order.payload) || {};
  const raw = order.values ?? order.env ?? payload.values ?? payload.env;

  if (!raw) {
    return null;
  }

  const parsed = parseJsonLoose(raw);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed;
  }

  return null;
}

function getVolumeValue(order = {}) {
  const payload = parseJsonLoose(order.payload) || {};
  const rawValue = order.value ?? order.volume ?? payload.value ?? payload.volume;

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function toEnvValue(value) {
  const text = String(value ?? '');

  if (text.length === 0) {
    return '""';
  }

  if (/[^\w./:@+-]/.test(text)) {
    return JSON.stringify(text);
  }

  return text;
}

function applyEnvChanges(filePath, changes) {
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = raw.length > 0 ? raw.split(/\r?\n/) : [];

  const pending = new Map();

  Object.entries(changes).forEach(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env key "${key}"`);
    }

    pending.set(key, value);
  });

  const changed = [];
  const removed = [];

  const nextLines = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);

    if (!match) {
      return line;
    }

    const key = match[1];

    if (!pending.has(key)) {
      return line;
    }

    const value = pending.get(key);
    pending.delete(key);

    if (value === null || value === undefined) {
      removed.push(key);
      return '';
    }

    changed.push(key);
    return `${key}=${toEnvValue(value)}`;
  });

  pending.forEach((value, key) => {
    if (value === null || value === undefined) {
      removed.push(key);
      return;
    }

    changed.push(key);
    nextLines.push(`${key}=${toEnvValue(value)}`);
  });

  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') {
    nextLines.pop();
  }

  const nextRaw = nextLines.join('\n');
  fs.writeFileSync(filePath, nextRaw.length > 0 ? `${nextRaw}\n` : '');

  return { changed, removed };
}

function getBashScriptPath(fileName) {
  return path.join(LAUNCHER_BASH_DIR, fileName);
}

function runDetachedBash(scriptName, args = []) {
  const scriptPath = getBashScriptPath(scriptName);

  const child = spawn('bash', [scriptPath, ...args], {
    cwd: PROJECT_ROOT,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
}

async function runCommand(command, args = [], options = {}) {
  try {
    const response = await execFile(command, args, {
      cwd: PROJECT_ROOT,
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: options.timeout ?? 60_000,
    });

    return {
      ok: true,
      stdout: String(response.stdout || '').trim(),
      stderr: String(response.stderr || '').trim(),
      code: 0,
    };
  } catch (err) {
    return {
      ok: false,
      stdout: String(err.stdout || '').trim(),
      stderr: String(err.stderr || err.message || '').trim(),
      code: Number(err.code) || 1,
    };
  }
}

async function updateOrder(orderId, change = {}) {
  if (!orderId) {
    return;
  }

  const payload = Object.fromEntries(
    Object.entries({
      launcherUpdatedAt: nowTs(),
      ...change,
    }).filter(([, value]) => value !== undefined)
  );

  await crud('orders').update(orderId, payload);
}

async function markRunning(order, worker, normalizedType) {
  await updateOrder(order.id, {
    launcherStatus: 'RUNNING',
    launcherWorker: worker,
    launcherStartedAt: nowTs(),
    launcherOrderType: normalizedType,
  });
}

async function markDone(order, data = {}) {
  await updateOrder(order.id, {
    launcherStatus: 'DONE',
    launcherHandledAt: nowTs(),
    ...data,
  });
}

async function markScheduled(order, data = {}) {
  await updateOrder(order.id, {
    launcherStatus: 'SCHEDULED',
    launcherHandledAt: nowTs(),
    ...data,
  });
}

async function markError(order, err) {
  await updateOrder(order.id, {
    launcherStatus: 'ERROR',
    launcherHandledAt: nowTs(),
    launcherError: formatError(err),
  });
}

async function handleStartPm2(order) {
  const appName = getPm2AppName(order);
  const output = await runCommand('bash', [getBashScriptPath('start-pm2.sh'), appName], {
    timeout: 40_000,
  });

  if (!output.ok) {
    throw new Error(output.stderr || 'Failed to start PM2 app');
  }

  await markDone(order, {
    launcherResult: `PM2 app started/restarted: ${appName}`,
    launcherOutput: truncateText([output.stdout, output.stderr].filter(Boolean).join('\n')),
  });
}

async function handleStopPm2(order) {
  const appName = getPm2AppName(order);

  await markScheduled(order, {
    launcherResult: `PM2 stop scheduled: ${appName}`,
  });

  runDetachedBash('stop-pm2.sh', [appName]);
}

async function handleRestartPm2(order) {
  const appName = getPm2AppName(order);

  await markScheduled(order, {
    launcherResult: `PM2 restart scheduled: ${appName}`,
  });

  runDetachedBash('restart-pm2.sh', [appName]);
}

async function handleSetVolume(order) {
  const volume = getVolumeValue(order);

  if (volume === null) {
    throw new Error('SET_VOLUME requires numeric value (0-100) in value/volume');
  }

  const output = await runCommand('bash', [getBashScriptPath('set-volume.sh'), String(volume)], {
    timeout: 20_000,
  });

  if (!output.ok) {
    throw new Error(output.stderr || 'Failed to set volume');
  }

  await markDone(order, {
    launcherResult: `Volume set to ${volume}%`,
    launcherVolume: volume,
    launcherOutput: truncateText([output.stdout, output.stderr].filter(Boolean).join('\n')),
  });
}

async function handleChangeEnv(order) {
  const values = getOrderValues(order);

  if (!values) {
    throw new Error('CHANGE_ENV requires values/env object');
  }

  const envFilePath = path.join(PROJECT_ROOT, '.env.pi');
  const { changed, removed } = applyEnvChanges(envFilePath, values);

  await markDone(order, {
    launcherResult: 'Env file updated',
    launcherEnvChanged: changed,
    launcherEnvRemoved: removed,
    launcherEnvFile: '.env.pi',
  });
}

async function handleDumpLogs(order) {
  const payload = parseJsonLoose(order.payload) || {};
  const appName = getPm2AppName(order);
  const rawLines = Number(order.lines ?? payload.lines ?? 30);
  const lines = Number.isFinite(rawLines) ? Math.min(200, Math.max(1, Math.round(rawLines))) : 30;

  const output = await runCommand('pm2', ['logs', appName, '--lines', String(lines), '--nostream'], {
    timeout: 20_000,
  });

  const text = truncateText([output.stdout, output.stderr].filter(Boolean).join('\n'));

  if (!text) {
    throw new Error('No log output received from PM2');
  }

  await markDone(order, {
    launcherResult: `Dumped ${lines} log lines for ${appName}`,
    launcherLogs: text,
    launcherLogLines: lines,
  });
}

async function handleSyncGit(order) {
  const output = await runCommand('bash', [getBashScriptPath('sync-git-nextgen.sh')], {
    timeout: 120_000,
  });

  if (!output.ok) {
    throw new Error(output.stderr || 'SYNC_GIT failed');
  }

  const combined = [output.stdout, output.stderr].filter(Boolean).join('\n').trim();
  const commitLine = combined
    .split(/\r?\n/)
    .reverse()
    .find((line) => /^([a-f0-9]{7,40})$/i.test(line.trim()));

  await markDone(order, {
    launcherResult: commitLine
      ? `Git synced to origin/nextgen @ ${commitLine.trim()}`
      : 'Git synced to origin/nextgen',
    launcherOutput: truncateText(combined),
    launcherGitCommit: commitLine ? commitLine.trim() : null,
  });
}

export async function handleLauncherOrder(order, options = {}) {
  const { worker = 'bridge-main', allowTypes = null } = options;

  if (!order || typeof order !== 'object') {
    return false;
  }

  const normalizedType = normalizeOrderType(order.orderType);

  if (!isLauncherOrderType(normalizedType)) {
    return false;
  }

  if (Array.isArray(allowTypes) && !allowTypes.includes(normalizedType)) {
    return false;
  }

  const currentStatus = String(order.launcherStatus || '').toUpperCase();

  if (FINAL_STATUSES.has(currentStatus)) {
    return true;
  }

  if (!order.id) {
    return true;
  }

  try {
    await markRunning(order, worker, normalizedType);

    switch (normalizedType) {
      case LAUNCHER_ORDER_TYPES.RESTART_PM2:
        await handleRestartPm2(order);
        break;
      case LAUNCHER_ORDER_TYPES.STOP_PM2:
        await handleStopPm2(order);
        break;
      case LAUNCHER_ORDER_TYPES.START_PM2:
        await handleStartPm2(order);
        break;
      case LAUNCHER_ORDER_TYPES.SET_VOLUME:
        await handleSetVolume(order);
        break;
      case LAUNCHER_ORDER_TYPES.CHANGE_ENV:
        await handleChangeEnv(order);
        break;
      case LAUNCHER_ORDER_TYPES.DUMP_LOGS:
        await handleDumpLogs(order);
        break;
      case LAUNCHER_ORDER_TYPES.SYNC_GIT:
        await handleSyncGit(order);
        break;
      default:
        break;
    }
  } catch (err) {
    await markError(order, err);
  }

  return true;
}

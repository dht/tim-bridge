export const LAUNCHER_ORDER_TYPES = Object.freeze({
  RESTART_PM2: 'RESTART_PM2',
  STOP_PM2: 'STOP_PM2',
  START_PM2: 'START_PM2',
  SET_VOLUME: 'SET_VOLUME',
  CHANGE_ENV: 'CHANGE_ENV',
  DUMP_LOGS: 'DUMP_LOGS',
  SYNC_GIT: 'SYNC_GIT',
});

const ORDER_TYPE_SET = new Set(Object.values(LAUNCHER_ORDER_TYPES));

export function normalizeOrderType(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
}

export function isLauncherOrderType(value = '') {
  return ORDER_TYPE_SET.has(normalizeOrderType(value));
}

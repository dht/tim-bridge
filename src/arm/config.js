import { readFile } from 'node:fs/promises';
import { sanitizePose } from './pose.js';

export const DEFAULT_POSITION_ID = 'basePosition';
export const DEFAULT_SETTLE_MS = 1500;
const CONFIG_URL = new URL('../index.robotic.json', import.meta.url);

function normalizePosition(position = {}) {
  const { id, description = '', settleMs = DEFAULT_SETTLE_MS } = position;

  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Each robotic position must include a non-empty string "id".');
  }

  const sanitized = sanitizePose(position.pose ?? position);
  if (!sanitized.ok) {
    throw new Error(`Position "${id}" is invalid: ${sanitized.error}.`);
  }

  return {
    id: id.trim(),
    description,
    settleMs: Number.isFinite(Number(settleMs)) ? Math.max(0, Number(settleMs)) : DEFAULT_SETTLE_MS,
    pose: sanitized.pose,
  };
}

export async function loadRoboticConfig() {
  const rawText = await readFile(CONFIG_URL, 'utf8');
  const parsed = JSON.parse(rawText);
  const positions = Array.isArray(parsed?.positions) ? parsed.positions : [];

  return {
    ...parsed,
    positions: positions.map((position) => normalizePosition(position)),
  };
}

export function getPositionById(config, positionId) {
  const { positions = [] } = config;
  const position = positions.find((entry) => entry.id === positionId);

  if (!position) {
    const availableIds = positions.map((entry) => entry.id).join(', ') || 'none';
    throw new Error(`Unknown robotic position "${positionId}". Available positions: ${availableIds}.`);
  }

  return position;
}

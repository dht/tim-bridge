import 'dotenv/config';
import { announce } from './utils/announce.js';

const CYCLE_SESSIONS_ID = process.env.CYCLE_SESSIONS_ID;
const ANNOUNCE_DURATION_MS = Number(process.env.ANNOUNCE_DURATION_MS ?? 40 * 1000);

function getCycleSessionIds(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function mainCycle() {
  const sessionIds = getCycleSessionIds(CYCLE_SESSIONS_ID);

  if (sessionIds.length === 0) {
    console.warn('CYCLE_SESSIONS_ID is empty. Nothing to cycle.');
    return;
  }

  console.log('CYCLE_SESSIONS_ID ->', sessionIds.join(', '));

  for (const sessionId of sessionIds) {
    console.log(`Starting session ${sessionId}...`);
    await announce(sessionId, { durationMs: ANNOUNCE_DURATION_MS });
  }
}

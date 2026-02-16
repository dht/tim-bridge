import 'dotenv/config';
import { announce } from './utils/announce.js';
import { BRIDGE_EVENTS, onBridgeEvent } from './utils/events.js';
import { guid4 } from './utils/guid.js';
import { initLogger } from './utils/logger.js';
import { playOrder } from './utils/orders.js';
import { delay } from './utils/timeline.utils.js';

const CLIENT_ID = process.env.CLIENT_ID;
const CYCLE_SESSIONS_ID = process.env.CYCLE_SESSIONS_ID;
const MACHINE_ID = process.env.MACHINE_ID;
const OFFLINE_MODE = process.env.OFFLINE_MODE === 'true';
const ANNOUNCE_DURATION_MS = Number(process.env.ANNOUNCE_DURATION_MS ?? 40 * 1000);
const POST_PLAY_ORDER_DELAY_MS = Number(process.env.POST_PLAY_ORDER_DELAY_MS ?? 5 * 1000);

function getCycleSessionIds(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function waitForPlaybackEnded(machineId, orderId) {
  return new Promise((resolve) => {
    const unsubscribe = onBridgeEvent(BRIDGE_EVENTS.PLAYBACK_ENDED, (event = {}) => {
      if (event.machineId !== machineId) {
        return;
      }

      if (event.orderId !== orderId) {
        return;
      }

      unsubscribe();
      resolve(event);
    });
  });
}

export async function mainCycle() {
  const logger = initLogger(CLIENT_ID, OFFLINE_MODE);

  logger.clearLogs();

  const sessionIds = getCycleSessionIds(CYCLE_SESSIONS_ID);

  if (sessionIds.length === 0) {
    console.warn('CYCLE_SESSIONS_ID is empty. Nothing to cycle.');
    return;
  }

  console.log('CYCLE_SESSIONS_ID ->', sessionIds.join(', '));
  console.log(`Starting cycle for machine ${MACHINE_ID} with ${sessionIds.length} sessions...`);

  for (const sessionId of sessionIds) {
    console.log(`Starting session ${sessionId}...`);
    await announce(sessionId, { durationMs: ANNOUNCE_DURATION_MS });

    const order = {
      id: guid4(),
      ts: Date.now(),
      machineId: MACHINE_ID,
      sessionId,
      orderType: 'PLAY',
    };

    const waitForOrderPlayback = waitForPlaybackEnded(MACHINE_ID, order.id);

    playOrder(order);
    await waitForOrderPlayback;

    await delay(POST_PLAY_ORDER_DELAY_MS);
  }
}

import { onBridgeOpen } from './lifecycle/index.js';
import { announce } from './utils/announce.js';
import { BRIDGE_EVENTS, onBridgeEvent } from './utils/events.js';
import { guid4 } from './utils/guid.js';
import { getIp } from './utils/ip.js';
import './utils/load-env.js';
import { initLogger } from './utils/logger.js';
import { playOrder } from './utils/orders.js';
import { delay } from './utils/timeline.utils.js';

const sessionIdsPerMachine = {
  'A-001-dev': ['_milki', '_meditation', '_shower'],
  'A-001-miffal': ['_milki', '_meditation', '_shower'],
  'A-002-dev': ['_nostalgia', '_mayo', '_hipsters'],
};

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

export async function mainCycle({ clientId, machineIds, durationMs, postPlayOrderDelayMs }) {
  const logger = initLogger(clientId, true);
  const machineId = machineIds[0];

  const sessionIds = sessionIdsPerMachine[machineId];

  logger.clearLogs();

  if (sessionIds.length === 0) {
    console.warn('CYCLE_SESSIONS_ID is empty. Nothing to cycle.');
    return;
  }

  console.log('CYCLE_SESSIONS_ID ->', sessionIds.join(', '));
  console.log(`Starting cycle for machine ${machineId} with ${sessionIds.length} sessions...`);

  const ip = await getIp();
  onBridgeOpen(machineId, { ip });

  for (const sessionId of sessionIds) {
    console.log(`Starting session ${sessionId}...`);
    await announce(sessionId, { durationMs });

    const order = {
      id: guid4(),
      ts: Date.now(),
      machineId,
      sessionId,
      orderType: 'PLAY',
    };

    const waitForOrderPlayback = waitForPlaybackEnded(machineId, order.id);

    playOrder(order);
    await waitForOrderPlayback;

    await delay(postPlayOrderDelayMs);
  }
}

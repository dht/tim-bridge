import { updateMachineCreator } from '../utils/firestore.js';
import { getLogger } from '../utils/globals.js';
import { setBridgeStatus } from '../utils/status.js';
import { playTimelineIdle } from '../utils/timeline.elevator.js';

export function onBridgeOpen(id, data) {
  const logger = getLogger();

  const { ip } = data;
  const updateMachine = updateMachineCreator(id);

  logger.info(`${id} onStart`, { ip });

  updateMachine({
    bridgeIp: ip,
    bridgeStatus: 'IDLE',
    isBridgeOnline: true,
  });

  playTimelineIdle(id);
}

export async function onBridgeClose(id, data) {
  const logger = getLogger();

  logger.info(`${id} onEnd`);

  const updateMachine = updateMachineCreator(id);

  return updateMachine({
    bridgeIp: '',
    bridgeStatus: 'OFFLINE',
    isBridgeOnline: false,
  });
}

export async function onPlaybackEnded(id, data) {
  const logger = getLogger();

  logger.info(`${id} onEnd`);

  setBridgeStatus(id, 'IDLE');

  playTimelineIdle(id);
}

import './load-env.js';
import { onBridgeClose } from '../lifecycle/index.js';
import { getLogger } from './globals.js';
import { getIp } from './ip.js';
import { parseMachineIds } from './machine-ids.js';

const MACHINE_IDS = process.env.MACHINE_IDS;

async function cleanupAndExit(code = 0) {
  const logger = getLogger();
  try {
    logger.info('Cleaning up before exit...');

    const ids = parseMachineIds(MACHINE_IDS);

    for (const id of ids) {
      try {
        const ip = await getIp();
        await onBridgeClose(id, { ip });
      } catch (err) {
        logger.error(`onEnd failed for ${id}`, err);
      }
    }
  } finally {
    process.exit(code);
  }
}

export const registerCleanupHandlers = () => {
  process.on('SIGINT', () => cleanupAndExit(0));
  process.on('SIGTERM', () => cleanupAndExit(0));
};

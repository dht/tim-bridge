import 'dotenv/config';
import { onBridgeClose } from '../lifecycle/index.js';
import { getLogger } from './globals.js';
import { getIp } from './ip.js';

const MACHINE_IDS = process.env.MACHINE_IDS;

async function cleanupAndExit(code = 0) {
  const logger = getLogger();
  try {
    logger.info('Cleaning up before exit...');

    const ids = MACHINE_IDS.split(',').map((id) => id.trim());

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

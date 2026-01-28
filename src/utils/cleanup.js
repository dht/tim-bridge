import 'dotenv/config';
import { MACHINES_DEV } from '../data/data.machines.js';
import { onBridgeClose } from '../lifecycle/index.js';

const MACHINE_ID = process.env.MACHINE_ID;
const IS_DEV = process.env.IS_DEV;

async function cleanupAndExit(code = 0) {
  const logger = getLogger();
  try {
    logger.info('Cleaning up before exit...');

    const ids = IS_DEV ? Object.keys(MACHINES_DEV) : [MACHINE_ID];

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

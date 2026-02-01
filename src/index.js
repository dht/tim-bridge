import 'dotenv/config';
import { MACHINES_DEV } from './data/data.machines.js';
import { startMachine } from './listen.js';
import { registerCleanupHandlers } from './utils/cleanup.js';
import { initFirestore } from './utils/firestore.js';
import { initLogger } from './utils/logger.js';

const MACHINE_ID = process.env.MACHINE_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const IS_DEV = process.env.IS_DEV === 'true';
const DEV_MACHINE_ID = process.env.DEV_MACHINE_ID;

async function main() {
  initFirestore();
  const logger = initLogger(CLIENT_ID);

  if (IS_DEV) {
    await logger.clearLogs();
  }

  // product or single machine dev
  if (!IS_DEV || DEV_MACHINE_ID) {
    // start one
    startMachine(MACHINE_ID);
  } else {
    // start all
    Object.values(MACHINES_DEV).forEach((machine) => {
      startMachine(machine.id);
    });
  }
}

main();
registerCleanupHandlers();

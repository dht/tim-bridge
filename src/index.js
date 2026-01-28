import 'dotenv/config';
import { MACHINES_DEV } from './data/data.machines.js';
import { startMachine } from './listen.js';
import { registerCleanupHandlers } from './utils/cleanup.js';
import { startHttpServer } from './utils/express.js';
import { initFirestore } from './utils/firestore.js';
import { initLogger } from './utils/logger.js';

const MACHINE_ID = process.env.MACHINE_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const IS_DEV = process.env.IS_DEV;

async function main() {
  initFirestore();
  const logger = initLogger(CLIENT_ID);

  if (IS_DEV) {
    startHttpServer();

    await logger.clearLogs();

    Object.values(MACHINES_DEV).forEach((machine) => {
      startMachine(machine.id);
    });
  } else {
    startMachine(MACHINE_ID);
  }
}

main();
registerCleanupHandlers();

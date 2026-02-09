import 'dotenv/config';
import { MACHINES_DEV } from './data/data.machines.js';
import { startMachine } from './listen.js';
import { initFirestore } from './utils/firestore.js';
import { initLogger } from './utils/logger.js';

const CLIENT_ID = process.env.CLIENT_ID;
const DEV_MACHINE_ID = process.argv[2] ?? process.env.DEV_MACHINE_ID;

export async function mainDev() {
  initFirestore();
  const logger = initLogger(CLIENT_ID);

  logger.clearLogs();

  let machineIds = Object.values(MACHINES_DEV).map((m) => m.id);

  if (DEV_MACHINE_ID) {
    machineIds = DEV_MACHINE_ID.split(',').map((id) => id.trim());
  }

  machineIds.forEach((machineId) => {
    startMachine(machineId);
  });
}

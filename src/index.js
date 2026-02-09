import 'dotenv/config';
import { mainDev } from './index.dev.js';
import { startMachine } from './listen.js';
import { registerCleanupHandlers } from './utils/cleanup.js';
import { initFirestore } from './utils/firestore.js';

const MACHINE_ID = process.argv[2] ?? process.env.MACHINE_ID;
const IS_DEV = process.env.IS_DEV === 'true';

async function main() {
  initFirestore();
  startMachine(MACHINE_ID);
}

if (IS_DEV) {
  mainDev();
} else {
  main();
}

registerCleanupHandlers();

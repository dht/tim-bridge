import { mainCycle } from './index.cycle.js';
import { startMachine } from './listen.js';
import { registerCleanupHandlers } from './utils/cleanup.js';
import { initFirestore } from './utils/firestore.js';
import './utils/load-env.js';
import { initLogger } from './utils/logger.js';

const CLIENT_ID = process.env.CLIENT_ID;
const MODE = process.env.MODE ?? 'full';
const MACHINE_IDS = process.env.MACHINE_IDS;

const args = {
  clientId: CLIENT_ID,
  mode: MODE,
  machineIds: MACHINE_IDS,
  removeCache: false,
  durationMs: 40 * 1000,
  postPlayOrderDelayMs: 5 * 1000,
};

async function main({ clientId, machineIds, removeCache }) {
  initFirestore();

  const logger = initLogger(clientId);
  logger.clearLogs();

  if (removeCache) {
    console.log('Removing cache...');
    fs.rmSync('./cache', { recursive: true, force: true });
  }

  machineIds.forEach((machineId) => {
    startMachine(machineId);
  });
}

console.table(args);
args.machineIds = args.machineIds.split(',').map((id) => id.trim());

// 'FULL' | 'ONLY-PRESETS' | 'CYCLE' | 'OFF';
switch (MODE) {
  case 'FULL':
  case 'ONLY-PRESETS':
    main(args);
    break;
  case 'CYCLE':
    mainCycle(args);
    break;
  case 'OFF':
    // Do nothing
    break;
  default:
    console.error(`Unknown mode: ${MODE}`);
    break;
}

registerCleanupHandlers();

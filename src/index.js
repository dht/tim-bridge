import 'dotenv/config';
import { mainCycle } from './index.cycle.js';
import { startMachine } from './listen.js';
import { registerCleanupHandlers } from './utils/cleanup.js';
import { initFirestore } from './utils/firestore.js';
import { initLogger } from './utils/logger.js';

const CLIENT_ID = process.env.CLIENT_ID;
const MODE = process.env.MODE ?? 'full';
const MACHINE_IDS = process.env.MACHINE_IDS.split(',').map((id) => id.trim());
const SESSION_IDS = process.env.SESSION_IDS.split(',').map((id) => id.trim());
const REMOVE_CACHE = false;
const ANNOUNCE_DURATION_MS = Number(process.env.ANNOUNCE_DURATION_MS ?? 40 * 1000);
const POST_PLAY_ORDER_DELAY_MS = Number(process.env.POST_PLAY_ORDER_DELAY_MS ?? 5 * 1000);

const args = {
  clientId: CLIENT_ID,
  machineIds: MACHINE_IDS,
  sessionIds: SESSION_IDS,
  removeCache: REMOVE_CACHE,
  durationMs: ANNOUNCE_DURATION_MS,
  postPlayOrderDelayMs: POST_PLAY_ORDER_DELAY_MS,
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

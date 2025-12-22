import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { logDevice } from './device.js';
import { listenToCollection } from './firestore.js';
import { callbacks } from './installations/index.js';
import { setStatus } from './rgb/rgb.js';

const MACHINE_ID = process.env.MACHINE_ID;

let lastKnownStatus = null;

const packageJsonPath = path.resolve('./package.json');
const p = fs.readJsonSync(packageJsonPath);

console.log(`=== TIM BRIDGE v${p.version} STARTING ===`);

// Catch unexpected crashes so we can see them in logs
const logCrash = (type, err) => {
  const message = err instanceof Error ? err.stack || err.message : err;
  console.error(`❌ ${type}:`, message);
};

logDevice();

process.on('uncaughtException', err => logCrash('Uncaught Exception', err));
process.on('unhandledRejection', err => logCrash('Unhandled Rejection', err));

function onChange(change) {
  try {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { timelineUrl, timelineUrlTs, status } = data;

    const delta = Date.now() - (timelineUrlTs || 0);
    const isRecent = delta < 2 * 60 * 1000; // 2 minutes

    if ((timelineUrl && isRecent) || MACHINE_ID === 'A-003') {
      console.log(`🔗 Timeline URL: ${timelineUrl}`);

      // Run installation-specific logic (A-001.js)
      const callback = callbacks[MACHINE_ID];

      if (!callback) {
        console.warn(`No onChange callback found for MACHINE_ID: ${MACHINE_ID}`);
        return;
      }

      callback(data);
    }

    // Update status
    lastKnownStatus = status || lastKnownStatus;

    // Map for RGB
    setStatus(lastKnownStatus);
  } catch (err) {
    console.error('❌ onChange error:', err);
  }
}

//
// ---------------------------------------------------------
// FIRESTORE LIVE LISTENER (onSnapshot)
// ---------------------------------------------------------
async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  const collection = MACHINE_ID === 'A-003' ? 'state' : 'machines';

  listenToCollection(collection, onChange);
}

run();
//

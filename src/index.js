import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { logDevice } from './device.js';
import { listenToCollection } from './firestore.js';
import { callbacks } from './installations/index.js';
import { machinesInfo } from './machines.js';
import { setStatus } from './rgb/rgb.js';

const MACHINE_ID = process.env.MACHINE_ID;
const machineInfo = machinesInfo[MACHINE_ID];
const playbackFlavour = machineInfo?.playbackFlavour || 'session';
const callback = callbacks[MACHINE_ID];

if (!callback) {
  console.warn(`No onChange callback found for MACHINE_ID: ${MACHINE_ID}`);
  process.exit(1);
}

const RECENT_DELTA_MS = 2 * 60 * 1000; // 2 minutes

setStatus('1.IDLE');
logDevice();

const packageJsonPath = path.resolve('./package.json');
const p = fs.readJsonSync(packageJsonPath);

console.log(`=== TIM BRIDGE v${p.version} STARTING ===`);

// Catch unexpected crashes so we can see them in logs
const logCrash = (type, err) => {
  const message = err instanceof Error ? err.stack || err.message : err;
  console.error(`❌ ${type}:`, message);
};

process.on('uncaughtException', err => logCrash('Uncaught Exception', err));
process.on('unhandledRejection', err => logCrash('Unhandled Rejection', err));

// installations with sessions and presets
function onChangeSession(change) {
  try {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { timelineUrl, timelineUrlTs, status } = data;

    const delta = Date.now() - (timelineUrlTs || 0);

    const isRecent = delta < RECENT_DELTA_MS;

    if (timelineUrl && isRecent) {
      console.log(`🔗 Timeline URL: ${timelineUrl}`);
      callback(data);
    }

    setStatus(status);
  } catch (err) {
    console.error('❌ onChange error:', err);
  }
}

function onChangeRealtime(change) {}

function onChange11Agent(change) {
  try {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { status, statusTs } = data;

    // installations with timelines (like claygon)
    const delta = Date.now() - (statusTs || 0);
    const isRecent = delta < RECENT_DELTA_MS;

    if (isRecent) {
      if (!callback) {
        console.warn(`No onChange callback found for MACHINE_ID: ${MACHINE_ID}`);
        return;
      }

      callback(data);
    }

    // Map for RGB
    setStatus(status);
  } catch (err) {
    console.error('❌ onChange error:', err);
  }
}

const onChangeMethods = {
  session: onChangeSession,
  realtime: onChangeRealtime,
  '11agent': onChange11Agent,
};

//
// ---------------------------------------------------------
// FIRESTORE LIVE LISTENER (onSnapshot)
// ---------------------------------------------------------
async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  const collection = MACHINE_ID === 'A-003' ? 'state' : 'machines';
  const onChange = onChangeMethods[playbackFlavour];

  listenToCollection(collection, onChange);
}

run();

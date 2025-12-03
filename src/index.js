import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { listenToCollection } from './firestore.js';
import { callbacks } from './installations/installations_map.js';
import { setStatus } from './rgb/rgb.js';

const MACHINE_ID = 'A-001';

let lastKnownStatus = null;

const packageJsonPath = path.resolve('./package.json');
const p = fs.readJsonSync(packageJsonPath);

console.log(`=== TIM BRIDGE v${p.version} STARTING ===`);

//
// ---------------------------------------------------------
// FIRESTORE LIVE LISTENER (onSnapshot)
// ---------------------------------------------------------
async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection('machines', change => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    // Update status
    lastKnownStatus = data.status || lastKnownStatus;

    // Map for RGB
    console.log('🔥 Live Update Status → LED Mode:', lastKnownStatus, '→', ledMode);
    setStatus(lastKnownStatus);

    // Run installation-specific logic (A-001.js)
    const onChange = callbacks[MACHINE_ID];
    if (!onChange) {
      console.warn(`No onChange callback found for MACHINE_ID: ${MACHINE_ID}`);
      return;
    }

    onChange(data);
  });
}

run();

//
// ---------------------------------------------------------
// FIRESTORE POLLING EVERY 10 SECONDS
// ---------------------------------------------------------
// const db = getFirestore();
//
// setInterval(async () => {
//   try {
//     const ref = doc(db, 'machines', MACHINE_ID);
//     const snapshot = await getDoc(ref);

//     if (!snapshot.exists()) return;

//     const data = snapshot.data();
//     const status = data.status;

//     console.log('🔄 Firestore Poll (10s):', status);

//     if (!status) return;

//     lastKnownStatus = status;

//     const ledMode = mapStatusToLedMode(status);
//     console.log('🔄 Polling → LED Mode:', ledMode);
//     setStatus(ledMode);

//   } catch (err) {
//     console.error('❌ Polling Firestore error:', err);
//   }
// }, 10_000);

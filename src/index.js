import 'dotenv/config';
import { listenToCollection } from './firestore.js';
import { callbacks } from './installations/installations_map.js';
import { setStatus } from './rgb.js';
import { mapStatusToLedMode } from './statusMapper.js';   // <-- NEW

import { doc, getDoc, getFirestore } from '@firebase/firestore';

const MACHINE_ID = 'A-001';
const db = getFirestore();

let lastKnownStatus = null;

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
    const ledMode = mapStatusToLedMode(lastKnownStatus);
    console.log('🔥 Live Update Status → LED Mode:', lastKnownStatus, '→', ledMode);
    setStatus(ledMode);

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
// HEARTBEAT: re-apply LED mode every 5 seconds
// ---------------------------------------------------------
console.log('💓 Heartbeat started.');

setInterval(() => {
  console.log('💓 Tick');

  if (!lastKnownStatus) return;

  const ledMode = mapStatusToLedMode(lastKnownStatus);
  console.log('[RGB heartbeat] refreshing LED status:', ledMode);
  setStatus(ledMode);
}, 5000);


//
// ---------------------------------------------------------
// FIRESTORE POLLING EVERY 10 SECONDS
// ---------------------------------------------------------
setInterval(async () => {
  try {
    const ref = doc(db, 'machines', MACHINE_ID);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const status = data.status;

    console.log('🔄 Firestore Poll (10s):', status);

    if (!status) return;

    lastKnownStatus = status;

    const ledMode = mapStatusToLedMode(status);
    console.log('🔄 Polling → LED Mode:', ledMode);
    setStatus(ledMode);

  } catch (err) {
    console.error('❌ Polling Firestore error:', err);
  }
}, 10_000);

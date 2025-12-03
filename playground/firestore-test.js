import 'dotenv/config';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs-extra';

var serviceAccount = fs.readJsonSync('./playground/service_account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://tim-os-default-rtdb.firebaseio.com',
});

const delay = ms => new Promise(res => setTimeout(res, ms));

// fetch all the firestore data
const db = getFirestore();

async function changeMachine(machineId, change) {
  const ref = db.collection('machines').doc(machineId);
  await ref.set(change, { merge: true });
  console.log(`Updated machine "${machineId}" with:`, change);
}

async function main() {
  const itemId = 'A-001';

  const arr = [
    '1.IDLE',
    '2a.GENERATING',
    '2b.READY',
    '3a.PLAYBACK',
    '3b.DONE',
    '4.RESETTING',
    '0.ERROR',
  ];

  for (const status of arr) {
    console.log(`\n--- Setting status to "${status}" ---`);
    await changeMachine(itemId, {
      status: status,
    });
    await delay(4000);
  }

  console.log('✅ Done');
}

main().catch(console.error);

/*
export const checkpoints = {
  : checkpointStart,
  : checkpointGenerating,
  : checkpointPlayback,
  : checkpointReady,
  : checkpointDone,
  : checkpointReset,
  : checkpointError,
};

*/

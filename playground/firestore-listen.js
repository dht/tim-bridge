import 'dotenv/config';
import { playMp3 } from '../src/audio.js';
import { init, listenToCollection } from '../src/firestore.js';

const MACHINE_ID = 'A-001';
const FRESH_WINDOW_MS = 30_000; // 30s

init();

function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection('machines', change => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { mp3Url, mp3UrlTs, lightStatus } = data;
    const delta = Date.now() - mp3UrlTs;

    console.log({
      mp3Url,
      mp3UrlTs,
      delta,
      lightStatus,
    });

    if (mp3Url && delta < FRESH_WINDOW_MS) {
      // simply play the latest url (replaces any current playback)
      playMp3(mp3Url);
    }
  });
}

run();

import 'dotenv/config';
import { playMp3, stopAudio } from './audio.js';
import { listenToCollection } from './firestore.js';
import { turnLightsOff, turnLightsOn } from './lights.js';

const INSTALLATION_ID = 'TS-001';
const FRESH_WINDOW_MS = 30_000; // 30s

function run() {
  console.log('Listening to Firestore collection "installations"...');
  console.log(`Installation ID: ${INSTALLATION_ID}`);

  listenToCollection('installations', (change) => {
    const { id, data } = change || {};
    if (id !== INSTALLATION_ID || !data) return;

    const { mp3Url, mp3UrlChangeTs } = data;
    const delta = Date.now() - mp3UrlChangeTs;
    console.log('mp3Url:', mp3Url, 'delta(ms):', delta);

    if (mp3Url && delta < FRESH_WINDOW_MS) {
      // simply play the latest url (replaces any current playback)
      playMp3(mp3Url);
    }
  });
}

process.on('SIGINT', () => {
  stopAudio();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAudio();
  process.exit(0);
});

async function test() {
  await delay(1000);
  turnLightsOn();
  await delay(2000);
  turnLightsOff();
  // await delay(2000);
  // spinMotor();
  // await delay(2000);
  // stopMotor();
}

// run();
test();

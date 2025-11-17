import 'dotenv/config';
import { playMp3 } from './audio.js';
import { listenToCollection } from './firestore.js';
import { turnLightsOn, turnLightsOff } from './lights.js';
import { delay } from './utils.js';

// speaker sequence
const LED1 = 11; // H-speaker
const LED2 = 13; // S-speaker

// paths to audio files
const sequence = [
  { led: LED1, file: 'io/H1.mp3' },
  { led: LED2, file: 'io/S1.mp3' },
  { led: LED1, file: 'io/H2.mp3' },
  { led: LED2, file: 'io/S2.mp3' },
  { led: LED1, file: 'io/H3.mp3' },
  { led: LED2, file: 'io/S3.mp3' },
];

const MACHINE_ID = 'A-001';
const FRESH_WINDOW_MS = 30_000; // 30s


// wrapper to wait for local MP3 file
async function playLocalFile(path) {
  console.log(`🎵 Playing: ${path}`);
  try {
    await playMp3(path);
  } catch (err) {
    console.error('❌ Error playing file:', err);
  }
}


async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection('machines', async (change) => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { mp3Url, mp3UrlTs } = data;
    const delta = Date.now() - mp3UrlTs;

    console.log({
      mp3Url,
      mp3UrlTs,
      delta,
    });

    // remote MP3 trigger from Firestore
    if (mp3Url && delta < FRESH_WINDOW_MS) {
      console.log('🎧 Playing mp3Url from Firestore:', mp3Url);
      await playMp3(mp3Url); // remote file
    }

    // now run the LED + audio sequence
    console.log('🎬 Starting LED + Audio sequence...');

    for (const { led, file } of sequence) {
      console.log(`💡 ON pin ${led}, playing ${file}`);
      turnLightsOn(led);

      await playLocalFile(file);

      turnLightsOff(led);
      await delay(400); // tiny pause
    }

    console.log('✅ Sequence complete.');
  });
}

run();

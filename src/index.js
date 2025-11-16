import 'dotenv/config';
import { playMp3 } from './audio.js';
import { listenToCollection } from './firestore.js';

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

// async function main() {
//   console.log('🎬 Starting LED + Audio sequence...');

//   for (const { led, file } of sequence) {
//     console.log(`💡 Lighting LED on pin ${led} and playing ${file}...`);
//     turnLightsOn(led);
//     await playFile(file);
//     turnLightsOff(led);
//     await delay(500); // short gap between clips
//   }

//   console.log('✅ Sequence complete.');
// }

async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection('machines', async change => {
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
      console.log('🎬 Starting LED + Audio sequence...');

      for (const { led, file } of sequence) {
        console.log(`💡 Lighting LED on pin ${led} and playing ${file}...`);
        turnLightsOn(led);
        await playFile(file);
        turnLightsOff(led);
        await delay(500); // short gap between clips
      }

      console.log('✅ Sequence complete.');
    }
  });
}

run();

import 'dotenv/config';
import { playMp3 } from './audio.js';
import { listenToCollection } from './firestore.js';
import { turnLights, turnLightsOff } from './lights.js';

const MACHINE_ID = 'A-001';
const FRESH_WINDOW_MS = 30_000; // 30s

async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection('machines', async change => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { mp3Url, mp3UrlTs, lightStatus } = data;
    const delta = Date.now() - mp3UrlTs;

    console.log({ mp3Url, mp3UrlTs, delta });

    if (mp3Url && delta < FRESH_WINDOW_MS) {
      console.log('🎧 Playing mp3Url from Firestore:', mp3Url);

      // -------------------------------------
      // 🟡 TURN BOTH LIGHTS ON WHEN PLAY STARTS
      // -------------------------------------

      // lightStatus: ONE, TWO, BOTH, NONE
      turnLights(lightStatus);

      try {
        await playMp3(mp3Url); // Wait for the entire playback
      } catch (err) {
        console.error('❌ Error playing mp3Url:', err);
      }

      // -------------------------------------
      // 🔵 TURN BOTH LIGHTS OFF WHEN DONE
      // -------------------------------------
      turnLightsOff([LED1, LED2]);

      console.log('✅ Playback + Lights completed.');
    }

    // -------------------------------------
    // (commented out old per-file LED sequence)
    //
    // for (const { led, file } of sequence) {
    //   turnLightsOn(led);
    //   await playMp3(file);
    //   turnLightsOff(led);
    // }
    // -------------------------------------
  });
}

run();

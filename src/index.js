import 'dotenv/config';
import { playMp3 } from './audio.js';
import { listenToCollection } from './firestore.js';
import { setStatus } from './led.js';
import { turnLights } from './lights.js';

const MACHINE_ID = 'A-001';

async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection('machines', async change => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { mp3Url, mp3UrlTs, lightStatus, status } = data;
    console.log({ mp3Url, mp3UrlTs, lightStatus, status });
    turnLights(lightStatus);
    if (status) {
      console.log('LED status:', status);
      setStatus(status);
    }

    if (!mp3Url) return;
    console.log('🎧 Playing mp3Url from Firestore:', mp3Url);

    // lightStatus: ONE, TWO, BOTH, NONE
    turnLights(lightStatus);

    try {
      await playMp3(mp3Url); // Wait for the entire playback
    } catch (err) {
      console.error('❌ Error playing mp3Url:', err);
    }
    turnLights(lightStatus);

    console.log('✅ Playback + Lights completed.');
  });
}

run();

import 'dotenv/config';
import { playMp3 } from './audio.js';
import { listenToCollection } from './firestore.js';
import { turnLights } from './lights.js';
import { setStatus, allOff as allRgbOff } from './led.js';   // ⬅️ add allOff

const MACHINE_ID = 'A-001';

async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection('machines', async change => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const { mp3Url, mp3UrlTs, lightStatus, status } = data;

    console.log({ mp3Url, mp3UrlTs, lightStatus, status });

    // 👉 Log and apply LED RGB status
    if (status) {
      console.log("🟢 New STATUS received:", status);
      setStatus(status);
    }

    // Speaker side lights (ONE/TWO/BOTH/NONE)
    turnLights(lightStatus);

    if (!mp3Url) return;

    console.log('🎧 Playing mp3Url from Firestore:', mp3Url);

    try {
      await playMp3(mp3Url);
    } catch (err) {
      console.error('❌ Error playing mp3Url:', err);
    }

    turnLights(lightStatus); // restore lights after playback
    console.log('✅ Playback + Lights completed.');
  });
}

// ---------------- Cleanup on Exit ------------------

async function shutdown() {
  console.log("\n🛑 Graceful shutdown: turning off LEDs…");

  // turn off speaker LEDs
  try {
    turnLights("NONE");
  } catch (_) {}

  // turn off RGB LED
  try {
    allRgbOff();
  } catch (_) {}

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ---------------- Start system ---------------------

run();

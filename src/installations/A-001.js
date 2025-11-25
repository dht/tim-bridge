// A-001: Houses
import { turnLights } from "../lights.js";
import { setStatus } from "../led.js";
import { playMp3 } from "../audio.js";

export async function onChange(data) {
  const { mp3Url, mp3UrlTs, lightStatus, status } = data;

  turnLights(lightStatus);

  if (status) {
    console.log("LED status:", status);
    setStatus(status);
  }

  if (!mp3Url) return;
  console.log("🎧 Playing mp3Url from Firestore:", mp3Url);

  // lightStatus: ONE, TWO, BOTH, NONE
  turnLights(lightStatus);

  try {
    await playMp3(mp3Url); // Wait for the entire playback
  } catch (err) {
    console.error("❌ Error playing mp3Url:", err);
  }
  turnLights(lightStatus);

  console.log("✅ Playback + Lights completed.");
}

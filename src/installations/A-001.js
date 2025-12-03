// A-001: Houses
import { turnLights } from "../lights.js";
import { setStatus } from "../rgb.js";
import { playMp3 } from "../audio.js";
import { mapStatusToLedMode } from "../statusMapper.js";


export async function onChange(data) {
  const { mp3Url, mp3UrlTs, lightStatus, status } = data;

  turnLights(lightStatus);

  if (status) {
    const ledMode = mapStatusToLedMode(status);
    console.log("LED status:", status, "=>", ledMode);
    setStatus(ledMode);
  }

  if (!mp3Url) return;

  console.log("🎧 Playing mp3Url from Firestore:", mp3Url);
  turnLights(lightStatus);

  try {
    await playMp3(mp3Url);
  } catch (err) {
    console.error("❌ Error playing mp3Url:", err);
  }

  turnLights(lightStatus);
  if (status) setStatus(mapStatusToLedMode(status));
  console.log("✅ Playback + Lights completed.");
}

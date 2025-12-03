// A-001: Houses
import { turnLights } from "../lights.js";
import { setStatus } from "../rgb.js";
import { playMp3 } from "../audio.js";


// Normalize Firestore status → LED mode names from led.js
function mapStatusToLedMode(status) {
  if (status.startsWith("1.")) return "IDLE";
  if (status.startsWith("2a.")) return "GENERATING";
  if (status.startsWith("2b.")) return "READY";
  if (status.startsWith("3a.")) return "PLAYBACK";
  if (status.startsWith("3b.")) return "DONE";
  if (status.startsWith("4."))  return "RESETTING";
  if (status.startsWith("0."))  return "ERROR";
  return "IDLE"; // fallback
}

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
  console.log("✅ Playback + Lights completed.");
}

// A-001: Houses
import { playMp3, stopAudio } from "../audio.js";
import { turnLights } from "../lights.js";
import { setStatus } from "../rgb/rgb.js";

export async function onChange(data) {
  const { mp3Url, mp3UrlTs, lightStatus, status } = data;

  // Always handle lights + LED status first
  turnLights(lightStatus);

  if (status) {
    console.log("LED status:", status);
    setStatus(status);
  }

  // If status is RESETTING → immediately stop any current audio
  if (status === "4.RESETTING") {
    console.log("🔇 Status is 4.RESETTING → stopping audio playback");
    stopAudio();
    return; // nothing more to do for this transition
  }

  // If there’s no mp3Url, nothing to play
  if (!mp3Url) return;

  console.log("🎧 Playing mp3Url from Firestore:", mp3Url);
  turnLights(lightStatus);

  try {
    await playMp3(mp3Url);
  } catch (err) {
    console.error("❌ Error playing mp3Url:", err);
  }

  // Restore lights + LED status after playback
  turnLights(lightStatus);
  if (status) {
    console.log("LED status:", status);
    setStatus(status);
  }
  console.log("✅ Playback + Lights completed.");
}

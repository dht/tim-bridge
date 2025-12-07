// A-002: TV

import { stopAudio } from "../audio.js";

export async function onChange(data) {
  const { mp3Url, mp3UrlTs, status } = data;

  console.log({ mp3Url, mp3UrlTs, status });

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

  if (!mp3Url) return;
  console.log("🎧 Playing mp3Url from Firestore:", mp3Url);

  try {
    await playMp3(mp3Url); // Wait for the entire playback
  } catch (err) {
    console.error("❌ Error playing mp3Url:", err);
  }

  console.log("✅ Playback + Images completed.");
}

// A-001: Houses
import { playMp3 } from '../audio.js';
import { turnLights } from '../lights.js';
import { setStatus } from '../rgb/rgb.js';

export async function onChange(data) {
  const { mp3Url, mp3UrlTs, lightStatus, status } = data;

  turnLights(lightStatus);

  if (status) {
    console.log('LED status:', status);
    setStatus(status);
  }

  if (!mp3Url) return;

  console.log('🎧 Playing mp3Url from Firestore:', mp3Url);
  turnLights(lightStatus);

  try {
    await playMp3(mp3Url);
  } catch (err) {
    console.error('❌ Error playing mp3Url:', err);
  }

  turnLights(lightStatus);
  if (status) {
    console.log('LED status:', status);
    setStatus(status);
  }
  console.log('✅ Playback + Lights completed.');
}

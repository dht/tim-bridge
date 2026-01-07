// timelinePlayback.js
import { playMp3, stopAudio } from './audio.js';
import { cacheSessionFromTimelineUrl } from './cache.js';
import { turnLights } from './lights.js';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let isRunning = false;
let runToken = 0; // increments to cancel loops

export function stopPlayback() {
  runToken += 1; // cancels any active loop
  stopAudio(); // immediate effect where it matters
  isRunning = false; // best-effort state
  console.log('🛑 stopPlayback()');
}

export async function startPlaybackFromTimelineUrl(timelineUrl) {
  // prevent overlapping runs
  if (isRunning) {
    console.log('⏳ Playback already running, ignoring new timelineUrl');
    return;
  }

  isRunning = true;
  const myToken = ++runToken;

  try {
    const { sessionId, timeline, resolveLocal } = await cacheSessionFromTimelineUrl(timelineUrl);

    console.log(`✅ Session cached: ${sessionId}. Items: ${timeline.length}`);

    for (const item of timeline ?? []) {
      if (runToken !== myToken) return; // canceled

      const state = item?.state ?? {};
      const durationSec = Number(item?.duration ?? 0);

      // Apply state (lights etc.)
      if (state.lightStatus) turnLights(state.lightStatus);

      // Optional if you ever include this inside timeline state:
      // if (state.status) setStatus(state.status);

      // Play audio if exists
      if (state.mp3Url) {
        const mp3Url = String(state.mp3Url).split('?')[0];
        const localMp3 = resolveLocal(mp3Url);

        if (!localMp3) {
          console.warn('mp3Url not under /sessions/, skipping:', mp3Url);
        } else {
          playMp3(localMp3);
          if (durationSec > 0) await sleep(durationSec * 1000);
        }
      } else {
        // No audio: just wait duration if present
        if (durationSec > 0) await sleep(durationSec * 1000);
      }

      if (runToken !== myToken) return; // canceled
      await sleep(1500);
    }

    console.log('🏁 Timeline done');
  } catch (err) {
    console.error('❌ Timeline playback error:', err);
  } finally {
    if (runToken === myToken) {
      isRunning = false;
    }
  }
}

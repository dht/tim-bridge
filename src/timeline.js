// timelinePlayback.js
import { playMp3, stopAudio } from "./audio.js";
import { cacheSessionFromTimelineUrl } from "./cache.js";
import { updateMachineCreator } from "./firestore.js";
import { turnLights } from "./lights.js";
import { log } from "./log.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let isRunning = false;
let runToken = 0; // increments to cancel loops

export function stopPlayback() {
  runToken += 1; // cancels any active loop
  stopAudio(); // immediate effect where it matters
  isRunning = false; // best-effort state
  log.info("🛑 stopPlayback()");
}

export async function startPlaybackFromTimelineUrl(machineId, timelineUrl) {
  // prevent overlapping runs

  if (isRunning) {
    log.warn("⏳ Playback already running, ignoring new timelineUrl", {
      machineId,
    });
    return;
  }

  isRunning = true;
  const myToken = ++runToken;
  log.info("timeline: playback start", { machineId, timelineUrl, myToken });
  const updateMachine = updateMachineCreator(machineId);

  try {
    const { sessionId, timeline, resolveLocal } =
      await cacheSessionFromTimelineUrl(machineId, timelineUrl);

    log.info("✅ Session cached", {
      sessionId,
      items: timeline?.length ?? 0,
    });

    await updateMachine({
      bridgeStatus: "PLAYBACK",
    });

    for (const item of timeline ?? []) {
      if (runToken !== myToken) return; // canceled

      const state = item?.state ?? {};
      const durationSec = Number(item?.duration ?? 0);
      log.info("timeline: item", {
        hasAudio: Boolean(state.mp3Url),
        hasLight: Boolean(state.lightStatus),
        durationSec,
      });

      // Apply state (lights etc.)
      if (state.lightStatus) {
        log.info("timeline: lights", { lightStatus: state.lightStatus });
        turnLights(state.lightStatus);
      }

      // Optional if you ever include this inside timeline state:
      // if (state.status) setStatus(state.status);

      // Play audio if exists
      if (state.mp3Url) {
        const mp3Url = String(state.mp3Url).split("?")[0];
        const localMp3 = resolveLocal(mp3Url);

        if (!localMp3) {
          log.warn("mp3Url not under /sessions/, skipping", { mp3Url });
        } else {
          log.info("timeline: play mp3", { localMp3 });
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

    log.info("🏁 Timeline done");
  } catch (err) {
    log.error("❌ Timeline playback error:", err);
  } finally {
    if (runToken === myToken) {
      isRunning = false;
    }

    await updateMachine({
      bridgeStatus: "IDLE",
    });
    log.info("timeline: playback ended", { machineId, myToken });
  }
}

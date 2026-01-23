// timelinePlayback.js
import { playMp3, stopAudio } from "./audio.js";
import { cacheSessionFromTimelineUrl } from "./cache.js";
import {
  clearKeyframesForMachine,
  updateKeyframe,
  updateMachineCreator,
  updateRunCreator,
} from "./firestore.js";
import { getLogger } from "./globals.js";
import { guid4 } from "./guid.js";
import { turnLights } from "./lights.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let isRunning = false;
let runToken = 0; // increments to cancel loops

export function stopPlayback() {
  const logger = getLogger();
  runToken += 1; // cancels any active loop
  stopAudio(); // immediate effect where it matters
  isRunning = false; // best-effort state
  logger.info("🛑 stopPlayback()");
}

function calcTimelineDuration(timeline = []) {
  try {
    const lastKeyframe = timeline[timeline.length - 1];
    if (!lastKeyframe) return 0;
    const endTs = Number(lastKeyframe.ts);
    return endTs;
  } catch {
    return 0;
  }
}

async function syncKeyframes(timeline = [], { machineId, sessionId }) {
  await clearKeyframesForMachine(machineId);

  for (let keyframe of timeline) {
    updateKeyframe(keyframe.id, {
      ...keyframe,
      machineId,
      sessionId,
    });
  }
}

export async function startPlaybackFromTimelineUrl(
  machineId,
  timelineUrl,
  runExtra = {},
) {
  const logger = getLogger();
  // prevent overlapping runs
  let isSuccess = true,
    error = null;

  if (isRunning) {
    logger.warn("⏳ Playback already running, ignoring new timelineUrl", {
      machineId,
    });
    return;
  }

  isRunning = true;
  const myToken = ++runToken;
  logger.info("timeline: playback start", { machineId, timelineUrl, myToken });
  const updateMachine = updateMachineCreator(machineId);

  const runId = guid4();
  const updateRun = updateRunCreator(runId);

  try {
    const { isPreset, sessionId, timeline, resolveLocal } =
      await cacheSessionFromTimelineUrl(machineId, timelineUrl);

    syncKeyframes(timeline, { machineId, sessionId });

    const duration = await calcTimelineDuration(timeline);

    await updateRun({
      id: runId,
      isPreset,
      machineId,
      sessionId,
      startTs: Date.now(),
      duration,
      timelineUrl,
      ...runExtra,
    });

    await updateMachine({
      bridgeStatus: "PLAYBACK",
      lastRunTs: Date.now(),
      timelineDuration: duration,
      timelineStartTime: Date.now(),
    });

    for (const item of timeline ?? []) {
      if (runToken !== myToken) return; // canceled

      const state = item?.state ?? {};
      const durationSec = Number(item?.duration ?? 0);
      logger.info("timeline: item", {
        hasAudio: Boolean(state.mp3Url),
        hasLight: Boolean(state.lightStatus),
        durationSec,
      });

      // Apply state (lights etc.)
      if (state.lightStatus) {
        logger.info("timeline: lights", { lightStatus: state.lightStatus });
        turnLights(state.lightStatus);
      }

      // Optional if you ever include this inside timeline state:
      // if (state.status) setStatus(state.status);

      // Play audio if exists
      if (state.mp3Url) {
        const mp3Url = String(state.mp3Url).split("?")[0];
        const localMp3 = resolveLocal(mp3Url);

        if (!localMp3) {
          logger.warn("mp3Url not under /sessions/, skipping", { mp3Url });
        } else {
          logger.info("timeline: play mp3", { localMp3 });
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

    logger.info("🏁 Timeline done");
  } catch (err) {
    logger.error("❌ Timeline playback error:", err);
    isSuccess = false;
    error = err;
  } finally {
    if (runToken === myToken) {
      isRunning = false;
    }

    await updateRun({
      endTs: Date.now(),
      isSuccess,
      error: error ? String(error) : "",
    });

    await updateMachine({
      bridgeStatus: "IDLE",
    });
    logger.info("timeline: playback ended", { machineId, myToken });
  }
}

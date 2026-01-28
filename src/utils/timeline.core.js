import { stopAllHardware } from '../hardware/index.js';
import { setTimelineState } from './globals.js';
import { applyKeyframes } from './keyframes.js';
import {
  delay,
  getRelevantKeyframes,
  getTimelineDuration,
  stopIfNeeded,
} from './timeline.utils.js';

const BEAT = 100; // ms

export async function playTimeline(machineId, timelineJson, playbackType) {
  if (!playbackType) {
    return;
  }

  console.log('Playing timeline with', timelineJson.length, 'items');

  const duration = getTimelineDuration(timelineJson);

  let startTs = Date.now(),
    ts = 0,
    playedIndex = {};

  setTimelineState(machineId, playbackType);
  stopAllHardware(machineId);

  await delay(50);

  while (ts < duration) {
    const didStop = stopIfNeeded(machineId, playbackType);

    if (didStop) {
      break;
    }

    const now = Date.now();
    ts = (now - startTs) / 1000; // in seconds

    const relevantKeyframes = getRelevantKeyframes(timelineJson, ts, playedIndex);

    await applyKeyframes(machineId, relevantKeyframes, playedIndex);

    await delay(BEAT);
  }
}

export async function loopTimeline(machineId, timelineJson, playbackType) {
  if (!playbackType) {
    return;
  }

  if (!timelineJson || timelineJson.length === 0) {
    console.log('No timeline to loop for machine:', machineId);
    return;
  }

  console.log('Looping timeline with', timelineJson.length, 'items');

  while (true) {
    const didStop = stopIfNeeded(machineId, playbackType);

    if (didStop) {
      break;
    }

    await playTimeline(machineId, timelineJson);
    await delay(1000);
  }
}

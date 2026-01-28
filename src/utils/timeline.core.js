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

export async function playTimeline(machineId, timelineJson) {
  console.log('Playing timeline with', timelineJson.length, 'items');

  const duration = getTimelineDuration(timelineJson);

  let startTs = Date.now(),
    ts = 0,
    playedIndex = {};

  setTimelineState(machineId, 'PLAYBACK');
  stopAllHardware(machineId);

  await delay(50);

  while (ts < duration) {
    const didStop = stopIfNeeded(machineId, 'PLAYBACK');

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

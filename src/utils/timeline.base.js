import { stopAllHardware } from '../hardware/index.js';
import { applyKeyframes } from './keyframes.js';
import {
  delay,
  getRelevantKeyframes,
  getTimelineDuration,
  stopIfNeeded,
} from './timeline.utils.js';

const BEAT = 100; // ms

export async function playTimeline(machineId, timelineJson, timelineType, options = {}) {
  const { silent } = options;

  if (!timelineType) return;

  if (!silent) {
    console.log(`Playing ${timelineType} with`, timelineJson.length, 'items');
  }

  // duration in seconds
  const duration = getTimelineDuration(timelineJson);

  let startTs = Date.now(),
    ts = 0,
    playedIndex = {};

  stopAllHardware(machineId);

  await delay(50);

  while (ts < duration) {
    const didStop = stopIfNeeded(machineId, timelineType);

    if (didStop) {
      stopAllHardware(machineId);
      break;
    }

    const now = Date.now();
    ts = (now - startTs) / 1000; // in seconds

    const relevantKeyframes = getRelevantKeyframes(timelineJson, ts, playedIndex);

    await applyKeyframes(machineId, relevantKeyframes, playedIndex, {
      timelineType,
    });

    await delay(BEAT);
  }
}

export async function loopTimeline(machineId, timelineJson, timelineType, options = {}) {
  const { silent } = options;

  if (!timelineType) return;

  if (!timelineJson || timelineJson.length === 0) {
    if (!silent) {
      console.log('No timeline to loop for machine:', machineId);
    }
    return;
  }

  if (!silent) {
    console.log('Looping timeline with', timelineJson.length, 'items');
  }

  while (true) {
    const didStop = stopIfNeeded(machineId, timelineType);

    if (didStop) {
      stopAllHardware(machineId);
      break;
    }

    console.time('playTimeline');
    await playTimeline(machineId, timelineJson, timelineType);
    console.timeEnd('playTimeline');

    await delay(1000);
  }
}

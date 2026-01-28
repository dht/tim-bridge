// type TimelineStatus = 'NONE' | 'IDLE' | 'GENERATING' | 'PLAYBACK';

import { stopAllHardware } from '../hardware';
import { getShouldStop, setShouldStop } from './globals';
import { applyKeyframe } from './keyframes';
import { delay, getRelevantKeyframes, getTimelineDuration } from './timeline.utils';

/*
  Concerns:
  - managing firestore state
  - controlling hardware

  Requirements:
  - be able to play a timeline (array of keyframes)
  - be able to stop a running playback
*/

let shouldStop = true;

export async function playTimeline(machineId, timelineJson) {
  console.log('Playing timeline with', timelineJson.length, 'items');

  const duration = getTimelineDuration(timelineJson);

  let startTs = Date.now(),
    ts = 0,
    playedIndex = {};

  setShouldStop(false);

  while (ts < duration) {
    const shouldStop = getShouldStop();

    if (shouldStop) {
      stopAllHardware(machineId)
      console.log('Stopping timeline playback for machine:', machineId);
      break;
    }

    const now = Date.now();
    ts = (now - startTs) / 1000; // in seconds

    const relevantKeyframes = getRelevantKeyframes(timelineJson, ts, playedIndex);

    for (const item of relevantKeyframes) {
      applyKeyframe(machineId, item);
      playedIndex[index] = true;
    }

    await delay(100);
  }
}

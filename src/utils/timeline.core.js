import { getTimelineState } from './globals.js';
import { playTimeline } from './timeline.base.js';

export async function playTimelineCore(machineId, timelineJson) {
  const currentTimelineStatus = getTimelineState(machineId);

  if (currentTimelineStatus === 'PLAYBACK') {
    console.log('Timeline already in PLAYBACK state');
    return;
  }

  await playTimeline(machineId, timelineJson, 'PLAYBACK');
}

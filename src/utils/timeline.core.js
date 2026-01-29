import { onPlaybackEnded } from '../lifecycle/_generic.js';
import { getTimelineState, setTimelineState } from './globals.js';
import { playTimeline } from './timeline.base.js';

export async function playTimelineCore(machineId, timelineJson) {
  const currentTimelineStatus = getTimelineState(machineId);

  if (currentTimelineStatus === 'PLAYBACK') {
    console.log('Timeline already in PLAYBACK state');
    return;
  }

  setTimelineState(machineId, 'PLAYBACK');

  console.time('playback-core');
  await playTimeline(machineId, timelineJson, 'PLAYBACK');
  console.timeEnd('playback-core');

  onPlaybackEnded(machineId);
}

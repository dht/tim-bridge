import { onPlaybackEnded } from '../lifecycle/_generic.js';
import { getTimelineState } from './globals.js';
import { setTimelineStatus } from './status.js';
import { playTimeline } from './timeline.base.js';

export async function playTimelineCore(machineId, timelineJson) {
  const currentTimelineStatus = getTimelineState(machineId);

  if (currentTimelineStatus === 'PLAYBACK' && !machineId.includes('S-001')) {
    console.log('Timeline already in PLAYBACK state');
    return;
  }

  setTimelineStatus(machineId, 'PLAYBACK');

  console.time('playback-core');
  await playTimeline(machineId, timelineJson, 'PLAYBACK');
  console.timeEnd('playback-core');

  onPlaybackEnded(machineId);
}

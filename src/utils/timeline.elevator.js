import { getTimelineState } from './globals.js';
import { setTimelineStatus } from './status.js';
import { loopTimeline, playTimeline } from './timeline.base.js';
import { getGeneratingTimeline, getRestTimeline } from './timeline.utils.js';

export const playTimelineGenerating = async (machineId) => {
  const currentTimelineStatus = getTimelineState(machineId);

  if (currentTimelineStatus === 'GENERATING') {
    console.log('Timeline already in GENERATING state');
    return;
  }

  const timelineJson = getGeneratingTimeline(machineId);
  if (!timelineJson) {
    console.log('No GENERATING timeline found');
  }

  setTimelineStatus(machineId, 'GENERATING');

  await playTimeline(machineId, timelineJson, 'GENERATING', { silent: false });
};

export const playTimelineIdle = async (machineId) => {
  const currentTimelineStatus = getTimelineState(machineId);

  if (currentTimelineStatus === 'IDLE') {
    console.log('Timeline already in IDLE state');
    return;
  }

  const timelineJson = getRestTimeline(machineId);
  if (!timelineJson) {
    console.log('No REST timeline found');
  }

  setTimelineStatus(machineId, 'IDLE');

  await loopTimeline(machineId, timelineJson, 'IDLE', { silent: false });
};

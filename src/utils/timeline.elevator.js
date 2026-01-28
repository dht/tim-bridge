import { getTimelineState, setTimelineState } from './globals.js';
import { loopTimeline, playTimeline } from './timeline.core.js';
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

  setTimelineState(machineId, 'GENERATING');

  await playTimeline(machineId, timelineJson, 'GENERATING');
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

  setTimelineState(machineId, 'IDLE');

  await loopTimeline(machineId, timelineJson, 'IDLE');
};

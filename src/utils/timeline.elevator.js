import { getTimelineState, setTimelineState } from './globals.js';

export const playTimelineGenerating = async machineId => {
  const currentTimelineStatus = getTimelineState(machineId);

  if (currentTimelineStatus === 'GENERATING') {
    console.log('Timeline already in GENERATING state');
    return;
  }

  setTimelineState(machineId, 'GENERATING');
};

export const playTimelineIdle = async machineId => {
  const currentTimelineStatus = getTimelineState(machineId);

  if (currentTimelineStatus === 'IDLE') {
    console.log('Timeline already in IDLE state');
    return;
  }

  setTimelineState(machineId, 'IDLE');
};

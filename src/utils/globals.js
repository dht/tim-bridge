// type TimelineStatus = 'NONE' | 'IDLE' | 'GENERATING' | 'PLAYBACK';

export const timelineState = {
  'A-001-dev': 'NONE',
};

export const getTimelineState = machineId => {
  return timelineState[machineId];
};

export const setTimelineState = (machineId, value) => {
  timelineState[machineId] = value;
};

// type TimelineStatus = 'NONE' | 'IDLE' | 'GENERATING' | 'PLAYBACK';

const timelineState = {
  'A-001-dev': 'NONE',
};

const shouldStop = false;

export const getTimelineState = machineId => {
  return timelineState[machineId];
};

export const setTimelineState = (machineId, value) => {
  timelineState[machineId] = value;
};

export const getShouldStop = () => {
  return shouldStop;
};

export const setShouldStop = value => {
  shouldStop = value;
};

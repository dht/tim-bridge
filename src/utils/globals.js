// type TimelineStatus = 'NONE' | 'IDLE' | 'GENERATING' | 'PLAYBACK';
let logger = null;

const timelineState = {
  'A-001-dev': 'NONE',
};

const shouldStop = {
  'A-001-dev': {
    IDLE: true,
    GENERATING: true,
    PLAYBACK: true,
  },
};

export const getTimelineState = (machineId) => {
  return timelineState[machineId];
};

export const setTimelineState = (machineId, value) => {
  timelineState[machineId] = value;

  ['IDLE', 'GENERATING', 'PLAYBACK'].forEach((type) => {
    if (type === value) return;
    shouldStop[machineId][type] = true;
  });

  shouldStop[machineId][value] = false;
};

export const getShouldStop = (machineId, timelineType) => {
  return shouldStop[machineId][timelineType];
};

export const setShouldStop = (machineId, timelineType, value) => {
  shouldStop[machineId][timelineType] = value;
};

export const setLogger = (value) => {
  logger = value;
};

export const getLogger = () => logger;

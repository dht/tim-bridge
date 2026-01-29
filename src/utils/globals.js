// type TimelineStatus = 'NONE' | 'IDLE' | 'GENERATING' | 'PLAYBACK';
let logger = null;

const timelineState = {
  'A-001-dev': 'NONE',
};

const shouldStop = {
  'A-001-dev': {
    IDLE: false,
    GENERATING: false,
    PLAYBACK: false,
  },
};

[
  'A-001-dev',
  'A-001-miffal',
  'A-002-dev',
  'A-003-dev',
  'A-004-dev',
  'A-005-dev',
  'A-006-dev',
  'A-007-dev',
  'A-901-miffal',
  'A-901-dev',
].forEach((machineId) => {
  timelineState[machineId] = 'NONE';
  shouldStop[machineId] = {
    IDLE: false,
    GENERATING: false,
    PLAYBACK: false,
  };
});

export const getTimelineState = (machineId) => {
  return timelineState[machineId];
};

export const setTimelineState = (machineId, value) => {
  timelineState[machineId] = value;


  ['IDLE', 'GENERATING', 'PLAYBACK'].forEach((type) => {
    if (type === value) return;
    setShouldStop(machineId, type, true);
  });

  setShouldStop(machineId, value, false);
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

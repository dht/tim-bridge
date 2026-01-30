import { MACHINE_IDS } from '../data/data.machines.js';

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

MACHINE_IDS.forEach((machineId) => {
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

const setShouldStop = (machineId, timelineType, value) => {
  shouldStop[machineId][timelineType] = value;
};

export const setLogger = (value) => {
  logger = value;
};

export const getLogger = () => logger;

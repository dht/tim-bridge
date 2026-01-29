import { applyHardware as applyAudio } from './audio.js';
import { applyHardware as applyLights } from './lights.js';

const hardwareFields = {
  mp3LocalPath: applyAudio,
  lightStatus: applyLights,
};

// meta has { machineId }
export const applyHardware = (fieldId, value, meta) => {
  if (!Object.keys(hardwareFields).includes(fieldId)) {
    return;
  }

  const applyFunction = hardwareFields[fieldId];

  if (typeof applyFunction !== 'function') {
    return;
  }

  applyFunction(fieldId, value, meta);
};

export const stopAllHardware = (machineId) => {};

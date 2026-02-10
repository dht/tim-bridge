import { applyHardware as applyAudio, stopAudio } from './audio.js';
import { applyHardware as applyLights, turnLights } from './lights.js';
import { closeBrowser, closeBrowserDelayed, openBrowser } from './browser.js';

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

export const stopAllHardware = (machineId) => {
  stopAudio();
  turnLights('NONE');
  closeBrowser();
};

export { openBrowser, closeBrowser, closeBrowserDelayed };

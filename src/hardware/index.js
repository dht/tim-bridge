import { applyHardware as applyAudio, stopAudio } from './audio.js';
import { applyBrowser, closeBrowser, closeBrowserDelayed, openBrowser } from './browser.js';
import { applyHardware as applyLights, turnLights } from './lights.js';

const hardwareFields = {
  mp3LocalPath: applyAudio,
  lightStatus: applyLights,
  browserUrl: applyBrowser,
};

// meta has { machineId }
export const applyHardware = (fieldId, value, meta) => {
  if (!Object.keys(hardwareFields).includes(fieldId)) {
    return;
  }

  console.log('value ->', value);

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

export { closeBrowser, closeBrowserDelayed, openBrowser };

import { applyHardware as applyAudio, stopAudio } from './audio.js';
import { applyBrowser, closeBrowser, closeBrowserDelayed, openBrowser } from './browser.js';
import { applyHardware as applyLights, turnLights } from './lights.js';

const hardwareFields = {
  mp3LocalPath: applyAudio,
  lightStatus: applyLights,
  browserUrl: applyBrowser, /*
    1. it's empty ('') => change the only tab to about:blank
    2. it's a URL=> change the only tab to the url

    applyUrlToOnlyTab
    

  */
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

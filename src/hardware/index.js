import { applyHardware as applyAudio, stopAudio } from './audio/index.js';
import {
  applyBrowser,
  changeToImageInBrowser,
  closeBrowser,
  closeBrowserDelayed,
  openBrowser,
  openOrUpdateBrowser as openBrowserSingle,
} from './browser/index.js';
import { applyHardware as applyLights, turnLights } from './lights/index.js';

const hardwareFields = {
  mp3LocalPath: applyAudio,
  lightStatus: applyLights,
  browserUrl: applyBrowser,
  imageUrl: changeToImageInBrowser,
};
/*
    1. it's empty ('') => change the only tab to about:blank
    2. it's a URL=> change the only tab to the url
*/

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
};

export { closeBrowser, closeBrowserDelayed, openBrowser, openBrowserSingle };

import * as pi from './browser.pi.js';
import * as mac from './browser.mac.js';

const impl = process.platform === 'darwin' ? mac : pi;

export const applyBrowser = impl.applyBrowser;
export const openOrUpdateBrowser = impl.openOrUpdateBrowser;
export const updateBrowserUrl = impl.updateBrowserUrl;
export const openBrowser = impl.openBrowser;
export const closeBrowser = impl.closeBrowser;
export const closeBrowserDelayed = impl.closeBrowserDelayed;
export const changeToImageInBrowser = impl.changeToImageInBrowser;

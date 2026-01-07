// 901 = Claygon / talking statues
// A-901: open browser in a normal window when GENERATING,
// close when RESETTING or ANY other status

import { closeBrowser, closeBrowserDelayed, openBrowser } from '../browser.js';

const MAX_SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes

let lastStatus = null;

const URL = 'https://tim-os.web.app/A-901/edge/running';

export async function onChange(data) {
  const { status, params } = data;

  if (!status) return;

  switch (status) {
    case '3b.DONE':
    case '4.RESETTING':
    case '1.IDLE':
      closeBrowser();
      break;
    case '3a.PLAYBACK':
      openBrowser(URL + '?language=' + (params?.language || 'en'));
      closeBrowserDelayed(MAX_SESSION_DURATION_MS);
      break;
  }

  lastStatus = status;
}

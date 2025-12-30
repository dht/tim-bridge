// 901 = Claygon / talking statues
// A-901: open browser in a normal window when GENERATING,
// close when RESETTING or ANY other status

import { closeBrowser, openBrowser } from '../browser.js';

let lastStatus = null;

const URL = 'https://tim-os.web.app/A-901/edge/running';

export async function onChange(data) {
  const { status, params } = data;

  if (!status) return;

  console.log(status);

  if (status === '3a.PLAYBACK') {
    openBrowser(URL + '?language=' + (params?.language || 'en'));
  }

  if (lastStatus === '3a.PLAYBACK') {
    switch (status) {
      case '3b.DONE':
      case '4.RESETTING':
      case '1.IDLE':
        closeBrowser();
        break;
    }
  }

  lastStatus = status;
}

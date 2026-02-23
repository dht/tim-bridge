import { closeBrowser, openBrowserSingle } from '../hardware/index.js';

export function onBridgeOpen(id, data) {
  console.log('onBridgeOpen');
  // openBrowserSingle('http://localhost:3000/');
  openBrowserSingle('https://tim-os.web.app/A-002-dev/edge');
}

export function onChange(id, data) {
  const { timelineUrl, status, originWebpageUrl } = ev.data;
}

export function onBridgeClose(id, data) {
  closeBrowser();
}

export const lifecycle = {
  onBridgeOpen,
  onChange,
  onBridgeClose,
};

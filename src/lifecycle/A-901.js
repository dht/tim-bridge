import { closeBrowser, openBrowserSingle } from '../hardware/index.js';

export function onBridgeOpen(id, data) {
  console.log('onBridgeOpen');
  openBrowserSingle('about:blank');
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

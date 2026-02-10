export function onBridgeOpen(id, data) {
/* TODO:
1. once bridge is up, open browser instance, using openBrowser with url: about:blank
2. to browser.js add a function: make sure only one tab is open.
*/
}

export function onChange(id, data) {
  const { timelineUrl, status, originWebpageUrl } = ev.data;
}

export function onBridgeClose(id, data) {
  // TODO
  // 1. close all browser instances
}

export const lifecycle = {
  onBridgeOpen,
  onChange,
  onBridgeClose,
};

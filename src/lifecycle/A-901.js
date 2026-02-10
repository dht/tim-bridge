export function onBridgeOpen(id, data) {
/* reach to point that:
1. you have one browser instance
2. with one tab
3. which is on url about:blank
*/
}

export function onChange(id, data) {
  const { timelineUrl, status, originWebpageUrl } = ev.data;
}

export function onBridgeClose(id, data) {
  // close all instances of browser

}

export const lifecycle = {
  onBridgeOpen,
  onChange,
  onBridgeClose,
};

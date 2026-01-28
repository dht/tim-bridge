export function onBridgeOpen(id, data) {}

export function onChange(id, data) {
  const { timelineUrl, status, originWebpageUrl } = ev.data;
}

export function onBridgeClose(id, data) {}

export const lifecycle = {
  onBridgeOpen,
  onChange,
  onBridgeClose,
};

import { EventEmitter } from 'events';

export const BRIDGE_EVENTS = {
  PLAYBACK_ENDED: 'PLAYBACK_ENDED',
};

const bridgeEvents = new EventEmitter();

export function emitBridgeEvent(event, payload = {}) {
  bridgeEvents.emit(event, payload);
}

export function onBridgeEvent(event, handler) {
  bridgeEvents.on(event, handler);

  return () => {
    bridgeEvents.off(event, handler);
  };
}

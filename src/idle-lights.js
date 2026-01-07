import { turnLights } from './lights.js';
import { isPlaybackActive } from './timeline.js';

let monitorInterval = null;
let lastState = null; // 'BOTH' or 'PLAYBACK'

export function startIdleLightsMonitor({ intervalMs = 5000 } = {}) {
  if (monitorInterval) return; // already running

  // initial check
  (async () => {
    try {
      const active = isPlaybackActive();
      if (!active) {
        await turnLights('BOTH');
        lastState = 'BOTH';
      } else {
        lastState = 'PLAYBACK';
      }
    } catch (err) {
      console.error('idle-lights initial check failed:', err);
    }
  })();

  monitorInterval = setInterval(async () => {
    try {
      const active = isPlaybackActive();

      if (!active && lastState !== 'BOTH') {
        await turnLights('BOTH');
        lastState = 'BOTH';
      }

      if (active && lastState !== 'PLAYBACK') {
        // Let timeline control the lights while playback runs
        lastState = 'PLAYBACK';
      }
    } catch (err) {
      console.error('idle-lights monitor error:', err);
    }
  }, intervalMs);
}

export function stopIdleLightsMonitor() {
  if (!monitorInterval) return;
  clearInterval(monitorInterval);
  monitorInterval = null;
}

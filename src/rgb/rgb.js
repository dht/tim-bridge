// engine.js
import { runPattern } from './rgb.utils.js';

export async function setStatus(status) {
  const pattern = PATTERNS[status];
  if (!pattern) {
    console.log('Unknown status:', status);
    return runPattern({ steps: [{ color: 'off', duration: 0 }], loop: false });
  }
  return runPattern(pattern);
}

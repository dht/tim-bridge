// engine.js
import { PATTERNS, STATUS_TO_PATTERN } from './rgb.data.js';
import { runPattern } from './rgb.utils.js';

export async function setStatus(status) {
  const pattern = STATUS_TO_PATTERN[status];

  if (!pattern) {
    console.log('Unknown RGB status:', status);
    return runPattern(PATTERNS.OFF);
  }

  return runPattern(pattern);
}

// engine.js
import { COLORS } from './rgb.data.js';

let rpio = null;

async function loadRpio() {
  const isPi = process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');
  if (!isPi) return null;

  try {
    const module = await import('rpio');
    module.default.init({ gpiomem: true });
    return module.default;
  } catch {
    return null;
  }
}

const rpioPromise = loadRpio();

const RED_PIN = 32;
const GREEN_PIN = 33;
const BLUE_PIN = 12;

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function writePin(pin, isOn) {
  const rpio = await rpioPromise;
  if (!rpio) return console.log(`simulate pin ${pin}: ${isOn}`);
  rpio.open(pin, rpio.OUTPUT, rpio.LOW);
  rpio.write(pin, isOn ? rpio.LOW : rpio.HIGH);
}

async function setColor(rgb) {
  await writePin(RED_PIN, rgb.r > 0);
  await writePin(GREEN_PIN, rgb.g > 0);
  await writePin(BLUE_PIN, rgb.b > 0);
}

let effectId = 0;

export async function runPattern(pattern) {
  effectId++;
  const myId = effectId;

  // Stop previous effect immediately
  await setColor(COLORS.off);

  do {
    for (const step of pattern.steps) {
      if (effectId !== myId) return;

      await setColor(COLORS[step.color]); // ← lookup named color
      const delayMs = step.duration > 0 ? step.duration : pattern.loop ? 50 : 0;
      if (delayMs > 0) await delay(delayMs); // prevent busy-loop on zero-duration loops

      if (effectId !== myId) return;
    }
  } while (pattern.loop && effectId === myId);
}

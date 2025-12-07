// engine.js
import { identifyDevice } from "../device.js";
import { COLORS } from "./rgb.data.js";

const SIMULATE_STATUS_LIGHT_MAC = false;

// Device detection (shared with rest of the app)
const deviceInfo = identifyDevice();
const { device, arch, armVersion, cpuModel, platform } = deviceInfo;

// Convenience flags
const IS_PI = device.startsWith("pi-");
const IS_MAC = device === "mac";

// Lazily load rpio only on Raspberry Pi devices
const rpioPromise = IS_PI
  ? (async () => {
      try {
        const module = await import("rpio");
        const rpio = module.default;
        rpio.init({ gpiomem: true });
        return rpio;
      } catch (err) {
        console.error(
          "[rgb] Failed to load rpio, running without hardware:",
          err
        );
        return null;
      }
    })()
  : Promise.resolve(null);

// GPIO pins (BCM numbering as before)
const RED_PIN = 32;
const GREEN_PIN = 33;
const BLUE_PIN = 12;

let pinsInitialized = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePins(rpio) {
  if (!rpio || pinsInitialized) return;

  rpio.open(RED_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.open(GREEN_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.open(BLUE_PIN, rpio.OUTPUT, rpio.LOW);

  pinsInitialized = true;
}

async function writePin(pin, isOn) {
  const rpio = await rpioPromise;
  if (!rpio) {
    // No hardware (e.g. macOS or “other” device). In simulation mode, logging is
    // handled in setColor, so we just no-op here.
    return;
  }

  await ensurePins(rpio);
  // Active-low LED: LOW = ON, HIGH = OFF
  rpio.write(pin, isOn ? rpio.LOW : rpio.HIGH);
}

async function setColor(rgb) {
  if (!rgb) return;

  await writePin(RED_PIN, rgb.r > 0);
  await writePin(GREEN_PIN, rgb.g > 0);
  await writePin(BLUE_PIN, rgb.b > 0);

  if (SIMULATE_STATUS_LIGHT_MAC && IS_MAC) {
    console.log(
      `[rgb] (simulated) device=${device} platform=${platform} arch=${arch} ` +
        `Set RGB LED to R:${rgb.r} G:${rgb.g} B:${rgb.b}`
    );
  }
}

let effectId = 0;

/**
 * Run an LED pattern.
 * pattern = {
 *   steps: [{ color: 'off' | 'red' | 'green' | ... , duration: number }],
 *   loop: boolean
 * }
 */
export async function runPattern(pattern) {
  if (!pattern || !Array.isArray(pattern.steps) || pattern.steps.length === 0) {
    // Nothing to do; just ensure LED is off
    await setColor(COLORS.off);
    return;
  }

  effectId += 1;
  const myId = effectId;

  // Stop previous effect immediately
  await setColor(COLORS.off);

  do {
    for (const step of pattern.steps) {
      if (effectId !== myId) return; // A newer pattern superseded this one

      const color = COLORS[step.color] ?? COLORS.off;
      await setColor(color);

      const duration = Number(step.duration) || 0;
      const delayMs = duration > 0 ? duration : pattern.loop ? 50 : 0;

      // Prevent tight busy-loop on looping patterns with zero duration
      if (delayMs > 0) {
        await delay(delayMs);
      }

      if (effectId !== myId) return; // Check again after delay
    }
  } while (pattern.loop && effectId === myId);
}

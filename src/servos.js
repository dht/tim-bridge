import i2c from 'i2c-bus';
import { Pca9685Driver } from 'pca9685';

/**
 * Defaults
 */
export const DEFAULT_PCA9685_I2C_BUS_NUMBER = 1;
export const DEFAULT_PCA9685_ADDRESS = 0x40;
export const DEFAULT_SERVO_FREQUENCY_HZ = 50;

export const DEFAULT_SERVO_MIN_DEG = 0;
export const DEFAULT_SERVO_MAX_DEG = 180;
export const DEFAULT_SERVO_MIN_MS = 0.5;
export const DEFAULT_SERVO_MAX_MS = 2.5;

/**
 * CONFIG
 */
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

// Adjust to match your servos if needed
const MIN_MS = 0.5;
const MAX_MS = 2.5;

const CHANNEL_MIN = 0;
const CHANNEL_MAX = 15;

/**
 * Internal state
 */
let pwm = null;
let i2cBus = null;
let isReady = false;

/**
 * Utilities
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function assertInitialized() {
  if (!pwm || !isReady) {
    throw new Error('PCA9685 not initialized. Call init() and wait for completion.');
  }
}

/**
 * Angle / pulse conversion
 */
export function degToMs(
  deg,
  {
    minDeg = DEFAULT_SERVO_MIN_DEG,
    maxDeg = DEFAULT_SERVO_MAX_DEG,
    minMs = DEFAULT_SERVO_MIN_MS,
    maxMs = DEFAULT_SERVO_MAX_MS,
    clampDeg = true,
  } = {}
) {
  const safeDeg = clampDeg ? clamp(deg, minDeg, maxDeg) : deg;
  const t = (safeDeg - minDeg) / (maxDeg - minDeg);
  return minMs + t * (maxMs - minMs);
}

export function msToTicks(ms, frequencyHz = DEFAULT_SERVO_FREQUENCY_HZ) {
  const periodMs = 1000 / frequencyHz;
  const ticks = Math.round((ms / periodMs) * 4096);
  return clamp(ticks, 0, 4095);
}

/**
 * Low-level PWM setters
 */
export function setServoPulseLengthUs(pwmInstance, channel, microseconds) {
  pwmInstance.setPulseLength(channel, microseconds);
}

export function setServoPulseLengthMs(pwmInstance, channel, ms) {
  setServoPulseLengthUs(pwmInstance, channel, ms * 1000);
}

/**
 * High-level servo control
 */
export function setServoAngleDeg(
  pwmInstance,
  channel,
  degrees,
  {
    minDeg = DEFAULT_SERVO_MIN_DEG,
    maxDeg = DEFAULT_SERVO_MAX_DEG,
    minMs = DEFAULT_SERVO_MIN_MS,
    maxMs = DEFAULT_SERVO_MAX_MS,
    clampDeg = true,
  } = {}
) {
  const ms = degToMs(degrees, { minDeg, maxDeg, minMs, maxMs, clampDeg });
  setServoPulseLengthMs(pwmInstance, channel, ms);
  return { ms, microseconds: ms * 1000 };
}

/**
 * Public API
 */
export function moveToAngle(channel, degrees) {
  return;
  assertInitialized();

  if (!Number.isInteger(channel) || channel < CHANNEL_MIN || channel > CHANNEL_MAX) {
    throw new Error(`Invalid channel ${channel}. Must be ${CHANNEL_MIN}–${CHANNEL_MAX}.`);
  }
  if (!Number.isFinite(degrees)) {
    throw new Error('Degrees must be a finite number.');
  }

  const { ms } = setServoAngleDeg(pwm, channel, degrees, {
    minMs: MIN_MS,
    maxMs: MAX_MS,
    clampDeg: true,
  });

  return {
    channel,
    degrees: clamp(degrees, DEFAULT_SERVO_MIN_DEG, DEFAULT_SERVO_MAX_DEG),
    ms,
  };
}

/**
 * PCA9685 initialization
 */
export function openPca9685(
  {
    i2cBusNumber = DEFAULT_PCA9685_I2C_BUS_NUMBER,
    address = DEFAULT_PCA9685_ADDRESS,
    frequencyHz = DEFAULT_SERVO_FREQUENCY_HZ,
    debug = false,
  } = {},
  onReady
) {
  const bus = i2c.openSync(i2cBusNumber);

  const driver = new Pca9685Driver(
    {
      i2c: bus,
      address,
      frequency: frequencyHz,
      debug,
    },
    err => {
      if (typeof onReady === 'function') {
        onReady(err, { pwm: driver, i2cBus: bus });
      }
    }
  );

  return { pwm: driver, i2cBus: bus };
}

/**
 * Initialize driver
 */
export function init() {
  if (isReady) return { pwm, i2cBus };

  const opened = openPca9685(
    {
      i2cBusNumber: I2C_BUS,
      address: PCA_ADDR,
      frequencyHz: FREQ,
    },
    err => {
      if (err) {
        throw err;
      }
      isReady = true;
    }
  );

  pwm = opened.pwm;
  i2cBus = opened.i2cBus;

  return { pwm, i2cBus };
}

/**
 * Clean shutdown
 */
export function shutdown() {
  try {
    // If PWM driver exists, set all channels to 0 pulse (no output)
    if (pwm && isReady) {
      try {
        for (let ch = CHANNEL_MIN; ch <= CHANNEL_MAX; ch++) {
          // set pulse length to 0 microseconds to disable output on channel
          try {
            setServoPulseLengthUs(pwm, ch, 0);
          } catch (err) {
            // ignore per-channel errors
          }
        }
      } catch (err) {
        // ignore
      }
    }

    if (i2cBus) i2cBus.closeSync();
  } finally {
    pwm = null;
    i2cBus = null;
    isReady = false;
  }
}

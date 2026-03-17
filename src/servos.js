import { createRequire } from 'node:module';

export const DEFAULT_PCA9685_I2C_BUS_NUMBER = 1;
export const DEFAULT_PCA9685_ADDRESS = 0x40;
export const DEFAULT_SERVO_FREQUENCY_HZ = 50;

export const DEFAULT_SERVO_MIN_DEG = 0;
export const DEFAULT_SERVO_MAX_DEG = 180;
export const DEFAULT_SERVO_MIN_MS = 0.5;
export const DEFAULT_SERVO_MAX_MS = 2.5;

const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;
const MIN_MS = 0.5;
const MAX_MS = 2.5;
const CHANNEL_MIN = 0;
const CHANNEL_MAX = 15;
const DEFAULT_INTER_SERVO_DELAY_MS = 120;

let pwm = null;
let i2cBus = null;
let isReady = false;
let i2c = null;
let pca9685 = null;
let i2cLoadError = null;
let pcaLoadError = null;
let lastInitError = null;
let moveQueue = Promise.resolve();

const require = createRequire(import.meta.url);

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getInterServoDelayMs() {
  const value = Number(process.env.ROBOTIC_SERVO_DELAY_MS);
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return DEFAULT_INTER_SERVO_DELAY_MS;
}

function assertInitialized() {
  if (!pwm || !isReady) {
    if (lastInitError) {
      throw new Error(`PCA9685 not initialized: ${lastInitError.message}`);
    }

    if (pcaLoadError) {
      throw new Error(`PCA9685 not initialized: ${pcaLoadError.message}`);
    }

    if (i2cLoadError) {
      throw new Error(`PCA9685 not initialized: ${i2cLoadError.message}`);
    }

    throw new Error('PCA9685 not initialized. Call init() and wait for completion.');
  }
}

function loadI2cBus() {
  if (i2c || i2cLoadError) {
    return { i2c, error: i2cLoadError };
  }

  if (process.platform !== 'linux') {
    i2cLoadError = new Error('i2c-bus is supported only on Linux platforms.');
    return { i2c: null, error: i2cLoadError };
  }

  try {
    i2c = require('i2c-bus');
  } catch (error) {
    i2cLoadError = error;
  }

  return { i2c, error: i2cLoadError };
}

function loadPca9685() {
  if (pca9685 || pcaLoadError) {
    return { pca9685, error: pcaLoadError };
  }

  try {
    pca9685 = require('pca9685');
  } catch (error) {
    pcaLoadError = error;
  }

  return { pca9685, error: pcaLoadError };
}

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
  const ratio = (safeDeg - minDeg) / (maxDeg - minDeg);
  return minMs + ratio * (maxMs - minMs);
}

export function msToTicks(ms, frequencyHz = DEFAULT_SERVO_FREQUENCY_HZ) {
  const periodMs = 1000 / frequencyHz;
  const ticks = Math.round((ms / periodMs) * 4096);
  return clamp(ticks, 0, 4095);
}

export function setServoPulseRangeTicks(pwmInstance, channel, ticks) {
  const safeTicks = clamp(Math.round(ticks), 0, 4095);
  pwmInstance.setPulseRange(channel, 0, safeTicks);
}

export function setServoPulseRangeMs(
  pwmInstance,
  channel,
  ms,
  { frequencyHz = DEFAULT_SERVO_FREQUENCY_HZ } = {}
) {
  const ticks = msToTicks(ms, frequencyHz);
  setServoPulseRangeTicks(pwmInstance, channel, ticks);
  return { ticks };
}

export function setServoPulseLengthUs(pwmInstance, channel, microseconds) {
  pwmInstance.setPulseLength(channel, microseconds);
}

export function setServoPulseLengthMs(pwmInstance, channel, ms) {
  setServoPulseLengthUs(pwmInstance, channel, ms * 1000);
}

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

export function moveToAngle(channel, degrees) {
  assertInitialized();

  if (!Number.isInteger(channel) || channel < CHANNEL_MIN || channel > CHANNEL_MAX) {
    throw new Error(`Invalid channel ${channel}. Must be ${CHANNEL_MIN}-${CHANNEL_MAX}.`);
  }

  if (!Number.isFinite(degrees)) {
    throw new Error('Degrees must be a finite number.');
  }

  const ms = degToMs(degrees, {
    minMs: MIN_MS,
    maxMs: MAX_MS,
    clampDeg: true,
  });

  const safeDegrees = clamp(degrees, DEFAULT_SERVO_MIN_DEG, DEFAULT_SERVO_MAX_DEG);
  const enqueuedAt = Date.now();
  const interServoDelayMs = getInterServoDelayMs();

  const movePromise = moveQueue.then(async () => {
    if (!pwm || !isReady) {
      throw new Error('Servo driver became unavailable before move execution.');
    }

    try {
      setServoAngleDeg(pwm, channel, safeDegrees, {
        minMs: MIN_MS,
        maxMs: MAX_MS,
        clampDeg: true,
      });
    } catch (error) {
      console.error('Servo move error:', error?.message || error);
      throw error;
    }

    if (interServoDelayMs > 0) {
      await delay(interServoDelayMs);
    }

    return {
      channel,
      degrees: safeDegrees,
      ms,
      enqueuedAt,
      completedAt: Date.now(),
      interServoDelayMs,
    };
  });

  moveQueue = movePromise.catch(() => {});
  return movePromise;
}

export function openPca9685(
  {
    i2cBusNumber = DEFAULT_PCA9685_I2C_BUS_NUMBER,
    address = DEFAULT_PCA9685_ADDRESS,
    frequencyHz = DEFAULT_SERVO_FREQUENCY_HZ,
    debug = false,
  } = {},
  onReady
) {
  const { i2c: i2cModule, error: i2cError } = loadI2cBus();
  if (!i2cModule || i2cError) {
    const error = i2cError || new Error('i2c-bus module unavailable.');
    if (typeof onReady === 'function') {
      onReady(error, { pwm: null, i2cBus: null });
    }
    return { pwm: null, i2cBus: null };
  }

  const { pca9685: pcaModule, error: pcaError } = loadPca9685();
  if (!pcaModule || pcaError) {
    const error = pcaError || new Error('pca9685 module unavailable.');
    if (typeof onReady === 'function') {
      onReady(error, { pwm: null, i2cBus: null });
    }
    return { pwm: null, i2cBus: null };
  }

  const bus = i2cModule.openSync(i2cBusNumber);
  const { Pca9685Driver } = pcaModule;

  const driver = new Pca9685Driver(
    {
      i2c: bus,
      address,
      frequency: frequencyHz,
      debug,
    },
    (error) => {
      if (typeof onReady === 'function') {
        onReady(error, { pwm: driver, i2cBus: bus });
      }
    }
  );

  return { pwm: driver, i2cBus: bus };
}

export function init() {
  if (isReady) {
    return { pwm, i2cBus };
  }

  lastInitError = null;

  const opened = openPca9685(
    {
      i2cBusNumber: I2C_BUS,
      address: PCA_ADDR,
      frequencyHz: FREQ,
    },
    (error) => {
      if (error) {
        lastInitError = error;
        console.warn('PCA9685 init skipped:', error.message);
        return;
      }

      isReady = true;
    }
  );

  pwm = opened.pwm;
  i2cBus = opened.i2cBus;

  return { pwm, i2cBus };
}

export async function waitUntilReady({ timeoutMs = 3000, intervalMs = 25 } = {}) {
  const start = Date.now();

  while (!isReady) {
    if (lastInitError) {
      throw new Error(`PCA9685 not initialized: ${lastInitError.message}`);
    }

    if (pcaLoadError) {
      throw new Error(`PCA9685 not initialized: ${pcaLoadError.message}`);
    }

    if (i2cLoadError) {
      throw new Error(`PCA9685 not initialized: ${i2cLoadError.message}`);
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for PCA9685 initialization.');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { pwm, i2cBus };
}

export function shutdown() {
  try {
    if (pwm && isReady) {
      for (let channel = CHANNEL_MIN; channel <= CHANNEL_MAX; channel += 1) {
        try {
          setServoPulseLengthUs(pwm, channel, 0);
        } catch {
          // Ignore per-channel shutdown failures.
        }
      }
    }

    if (i2cBus) {
      i2cBus.closeSync();
    }
  } finally {
    pwm = null;
    i2cBus = null;
    isReady = false;
    lastInitError = null;
    moveQueue = Promise.resolve();
  }
}

import i2c from 'i2c-bus';
import { setTimeout as wait } from 'node:timers/promises';
import { Pca9685Driver } from 'pca9685';

// ================== CONFIG ==================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const CHANNEL = 0;
const FREQ = 50;

// Servo calibration
const CENTER_MS = 1.5; // center pulse
const MS_PER_DEGREE = 1.0 / 180; // ≈0.0055 ms per degree (tune later)

// Safety limits (assembled arm!)
const MIN_MS = 1.2;
const MAX_MS = 1.8;
// ============================================

function msToTicks(ms) {
  const periodMs = 1000 / FREQ; // 20ms at 50Hz
  return Math.round((ms / periodMs) * 4096);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Move servo relative to center by degrees
 * @param {number} deg - degrees from center (negative = left, positive = right)
 */
function moveByDegrees(pwm, deg) {
  const targetMs = CENTER_MS + deg * MS_PER_DEGREE;
  const safeMs = clamp(targetMs, MIN_MS, MAX_MS);
  const ticks = msToTicks(safeMs);

  console.log(`🦾 Move ${deg}° → ${safeMs.toFixed(3)} ms → ${ticks} ticks`);

  pwm.setPulseRange(CHANNEL, 0, ticks);
}

// ============================================

console.log('🔧 Opening I2C bus...');
const i2cBus = i2c.openSync(I2C_BUS);

const pwm = new Pca9685Driver(
  {
    i2c: i2cBus,
    address: PCA_ADDR,
    frequency: FREQ,
    debug: false,
  },
  async err => {
    if (err) {
      console.error('❌ PCA9685 init failed:', err);
      process.exit(1);
    }

    console.log('✅ PCA9685 ready');
    console.log(`📡 Channel ${CHANNEL}`);
    console.log('');

    try {
      // Center
      moveByDegrees(pwm, 0);
      await wait(1500);

      // ±45° test
      moveByDegrees(pwm, -10);
      await wait(1200);

      moveByDegrees(pwm, +10);
      await wait(1200);

      // Back to center
      moveByDegrees(pwm, 0);
      await wait(1200);

      console.log('✅ Degree-based movement test completed');
    } catch (e) {
      console.error('💥 Runtime error:', e);
    } finally {
      console.log('🛑 Shutting down');
      process.exit(0);
    }
  }
);

#!/usr/bin/env node

import i2c from 'i2c-bus';
import { Pca9685Driver } from 'pca9685';

// ================== CONFIG ==================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

const CENTER_MS = 1.5;
const MS_PER_DEGREE = 1.0 / 120; // calibrated, not theoretical

const MIN_MS = 1.2;
const MAX_MS = 1.8;
// ============================================

// ---------- CLI parsing ----------
const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const channel = Number(getArg('-n'));
const degrees = Number(getArg('-d'));

if (Number.isNaN(channel) || Number.isNaN(degrees)) {
  console.error('Usage: servo -n <channel> -d <degrees>');
  process.exit(1);
}

// ---------- Helpers ----------
function msToTicks(ms) {
  const periodMs = 1000 / FREQ;
  return Math.round((ms / periodMs) * 4096);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ---------- Main ----------
const i2cBus = i2c.openSync(I2C_BUS);

new Pca9685Driver(
  {
    i2c: i2cBus,
    address: PCA_ADDR,
    frequency: FREQ,
    debug: false,
  },
  err => {
    if (err) {
      console.error('❌ PCA9685 init failed:', err);
      process.exit(1);
    }

    const targetMs = CENTER_MS + degrees * MS_PER_DEGREE;
    const safeMs = clamp(targetMs, MIN_MS, MAX_MS);
    const ticks = msToTicks(safeMs);

    console.log(`🦾 CH${channel} → ${degrees}° → ${safeMs.toFixed(3)} ms → ${ticks} ticks`);

    // on=0, off=ticks
    this?.setPulseRange ? this.setPulseRange(channel, 0, ticks) : undefined;

    // Exit immediately — PWM keeps running
    process.exit(0);
  }
);

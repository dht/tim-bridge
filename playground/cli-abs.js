#!/usr/bin/env node

import i2c from 'i2c-bus';
import { Pca9685Driver } from 'pca9685';

// ===== CONFIG =====
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

// Typical safe range for positional servos
const MIN_MS = 0.5; // ~0°
const MAX_MS = 2.5; // ~180°

const HOLD_FOREVER = true;
// ==================

// ---- CLI ----
const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const channel = Number(getArg('-n'));
const angle = Number(getArg('-d'));

if (Number.isNaN(channel) || Number.isNaN(angle)) {
  console.error('Usage: node cli-servo-abs.js -n <channel> -d <0..180>');
  process.exit(1);
}

// ---- Helpers ----
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function angleToMs(deg) {
  return MIN_MS + (deg / 180) * (MAX_MS - MIN_MS);
}

function msToTicks(ms) {
  const periodMs = 1000 / FREQ;
  return Math.round((ms / periodMs) * 4096);
}

// ---- Main ----
const i2cBus = i2c.openSync(I2C_BUS);

const pwm = new Pca9685Driver(
  {
    i2c: i2cBus,
    address: PCA_ADDR,
    frequency: FREQ,
    debug: false,
  },
  err => {
    if (err) {
      console.error('PCA9685 init failed:', err);
      process.exit(1);
    }

    const safeAngle = clamp(angle, 0, 180);
    const ms = angleToMs(safeAngle);
    const ticks = msToTicks(ms);

    console.log(`CH${channel} → ${safeAngle}° → ${ms.toFixed(3)} ms → ${ticks} ticks`);

    pwm.setPulseRange(channel, 0, ticks);

    console.log('Holding position. Ctrl+C to exit.');
  }
);

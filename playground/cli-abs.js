#!/usr/bin/env node

import {
  clamp,
  msToTicks,
  openPca9685,
  setServoPulseRangeTicks,
} from "../src/servos.js";

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

const channel = Number(getArg("-n"));
const angle = Number(getArg("-d"));

if (Number.isNaN(channel) || Number.isNaN(angle)) {
  console.error("Usage: node cli-servo-abs.js -n <channel> -d <0..180>");
  process.exit(1);
}

// ---- Helpers ----
function angleToMs(deg) {
  return MIN_MS + (deg / 180) * (MAX_MS - MIN_MS);
}

// ---- Main ----
const { pwm } = openPca9685(
  {
    i2cBusNumber: I2C_BUS,
    address: PCA_ADDR,
    frequencyHz: FREQ,
    debug: false,
  },
  (err) => {
    if (err) {
      console.error("PCA9685 init failed:", err);
      process.exit(1);
    }

    const safeAngle = clamp(angle, 0, 180);
    const ms = angleToMs(safeAngle);
    const ticks = msToTicks(ms);

    console.log(
      `CH${channel} → ${safeAngle}° → ${ms.toFixed(3)} ms → ${ticks} ticks`
    );

    setServoPulseRangeTicks(pwm, channel, ticks);

    console.log("Holding position. Ctrl+C to exit.");
  }
);

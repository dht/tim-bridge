#!/usr/bin/env node

import { setTimeout as wait } from "node:timers/promises";
import {
  clamp,
  msToTicks,
  openPca9685,
  setServoPulseRangeTicks,
} from "../src/servos.js";

// ================== CONFIG ==================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

const CENTER_MS = 1.5;
const MS_PER_DEGREE = 1.0 / 120;

const MIN_MS = 1.2;
const MAX_MS = 1.8;

const HOLD_TIME_MS = 5000; // keep command active
// ============================================

// ---------- CLI parsing ----------
const args = process.argv.slice(2);

function getArg(flag, def = null) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : def;
}

const channel = Number(getArg("-n"));
const degrees = Number(getArg("-d", 0)); // DEFAULT 0°

if (Number.isNaN(channel)) {
  console.error("Usage: servo -n <channel> [-d <degrees>]");
  process.exit(1);
}

// ---------- Helpers ----------
// ---------- Main ----------
console.log("🔧 Opening I2C bus...");
const { pwm } = openPca9685(
  {
    i2cBusNumber: I2C_BUS,
    address: PCA_ADDR,
    frequencyHz: FREQ,
    debug: false,
  },
  async (err) => {
    if (err) {
      console.error("❌ PCA9685 init failed:", err);
      process.exit(1);
    }

    const targetMs = CENTER_MS + degrees * MS_PER_DEGREE;
    const safeMs = clamp(targetMs, MIN_MS, MAX_MS);
    const ticks = msToTicks(safeMs);

    console.log(
      `🦾 CH${channel} → ${degrees}° → ${safeMs.toFixed(3)} ms → ${ticks} ticks`
    );
    console.log(`⏳ Holding position for ${HOLD_TIME_MS / 1000}s…`);

    setServoPulseRangeTicks(pwm, channel, ticks);

    // Keep process alive so motion + holding is observable
    await wait(HOLD_TIME_MS);

    console.log("🛑 Done. Exiting (PWM continues on hardware).");
    process.exit(0);
  }
);

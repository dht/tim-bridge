#!/usr/bin/env node

import { setTimeout as wait } from "node:timers/promises";
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

const CENTER_MS = 1.5;
const MS_PER_DEGREE = 1 / 120;

const MIN_MS = 0.8;
const MAX_MS = 2.2;

// ✅ Only these channels
const SERVO_CHANNELS = [1, 2, 3, 4];

const STEP_DELAY_MS = 1000;
// ==================

// ---- CLI ----
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? Number(args[i + 1]) : null;
}

const D = getArg("-d");

if (Number.isNaN(D)) {
  console.error("Usage: node check-all-servo-by-d.js -d <degrees>");
  process.exit(1);
}

// ---- Helpers ----
function moveDeg(pwm, ch, deg) {
  const ms = clamp(CENTER_MS + deg * MS_PER_DEGREE, MIN_MS, MAX_MS);
  const ticks = msToTicks(ms);
  setServoPulseRangeTicks(pwm, ch, ticks);
}

// ---- Main ----
const { pwm } = openPca9685(
  {
    i2cBusNumber: I2C_BUS,
    address: PCA_ADDR,
    frequencyHz: FREQ,
    debug: false,
  },
  async (err) => {
    if (err) {
      console.error("PCA9685 init failed:", err);
      process.exit(1);
    }

    console.log(
      `🔎 Checking servos [${SERVO_CHANNELS.join(", ")}] with ±${D}°`
    );

    for (const ch of SERVO_CHANNELS) {
      console.log(`\n🦾 Channel ${ch}`);

      moveDeg(pwm, ch, 0);
      await wait(STEP_DELAY_MS);

      moveDeg(pwm, ch, +D / 2);
      await wait(STEP_DELAY_MS);

      moveDeg(pwm, ch, -D);
      await wait(STEP_DELAY_MS);

      moveDeg(pwm, ch, 0);
      await wait(STEP_DELAY_MS);
    }

    console.log("\n✅ Done. Selected servos tested.");
    process.exit(0);
  }
);

#!/usr/bin/env node

import i2c from "i2c-bus";
import { setTimeout as wait } from "node:timers/promises";
import { Pca9685Driver } from "pca9685";

// ===== CONFIG =====
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

// Same safe range as cli-servo-abs.js
const MIN_MS = 0.5;   // 0°
const MAX_MS = 2.5;   // 180°
const CENTER_DEG = 90;

// Only these channels
const SERVO_CHANNELS = [1];

const STEP_DELAY_MS = 1000;
// ==================

// ---- CLI ----
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? Number(args[i + 1]) : NaN;
}

const D = getArg("-d");

if (Number.isNaN(D) || D <= 0) {
  console.error("Usage: node check-all-servos-by-d.js -d <degrees>");
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

function moveToAngle(pwm, ch, deg) {
  const safeDeg = clamp(deg, 0, 180);
  const ms = angleToMs(safeDeg);
  const ticks = msToTicks(ms);

  console.log(
    `  CH${ch} → ${safeDeg}° → ${ms.toFixed(3)} ms → ${ticks} ticks`
  );

  pwm.setPulseRange(ch, 0, ticks);
}

// ---- Main ----
const i2cBus = i2c.openSync(I2C_BUS);

new Pca9685Driver(
  {
    i2c: i2cBus,
    address: PCA_ADDR,
    frequency: FREQ,
    debug: false,
  },
  async err => {
    if (err) {
      console.error("PCA9685 init failed:", err);
      process.exit(1);
    }

    console.log(
      `🔎 Checking servos [${SERVO_CHANNELS.join(", ")}] with ±${D}°`
    );

    for (const ch of SERVO_CHANNELS) {
      console.log(`\n🦾 Channel ${ch}`);

      moveToAngle(pwm, ch, CENTER_DEG);
      await wait(STEP_DELAY_MS);

      moveToAngle(pwm, ch, CENTER_DEG + D);
      await wait(STEP_DELAY_MS);

      moveToAngle(pwm, ch, CENTER_DEG - D);
      await wait(STEP_DELAY_MS);

      moveToAngle(pwm, ch, CENTER_DEG);
      await wait(STEP_DELAY_MS);
    }

    console.log("\n✅ Done. Selected servos tested.");
    process.exit(0);
  }
);

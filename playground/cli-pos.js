#!/usr/bin/env node

import readline from "readline";
import { openPca9685, setServoAngleDeg } from "../src/servos.js";

// ===== CONFIG =====
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

const MIN_MS = 0.5;
const MAX_MS = 2.5;
// ==================

function moveToAngle(pwm, ch, deg) {
  const { ms } = setServoAngleDeg(pwm, ch, deg, {
    minMs: MIN_MS,
    maxMs: MAX_MS,
  });
  console.log(`🦾 CH${ch} → ${deg}° (${ms.toFixed(3)} ms)`);
}

// ---- INIT ----
const { pwm } = openPca9685(
  {
    i2cBusNumber: I2C_BUS,
    address: PCA_ADDR,
    frequencyHz: FREQ,
  },
  (err) => {
    if (err) {
      console.error("❌ PCA9685 init failed", err);
      process.exit(1);
    }

    console.log("✅ PCA9685 ready");
    console.log("🔒 Holding servos (PWM active)");
    console.log("👉 Commands: -n <ch> -d <deg>");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    rl.prompt();

    rl.on("line", (line) => {
      const args = line.trim().split(/\s+/);

      const nIdx = args.indexOf("-n");
      const dIdx = args.indexOf("-d");

      if (nIdx === -1 || dIdx === -1) {
        console.log("❌ Usage: -n <ch> -d <deg>");
        rl.prompt();
        return;
      }

      const ch = Number(args[nIdx + 1]);
      const deg = Number(args[dIdx + 1]);

      if (Number.isNaN(ch) || Number.isNaN(deg)) {
        console.log("❌ Invalid numbers");
        rl.prompt();
        return;
      }

      moveToAngle(pwm, ch, deg);
      rl.prompt();
    });
  }
);

export function onChange() {}

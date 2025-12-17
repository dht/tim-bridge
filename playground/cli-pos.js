#!/usr/bin/env node

import i2c from 'i2c-bus';
import { Pca9685Driver } from 'pca9685';
import readline from 'readline';

// ===== CONFIG =====
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

const MIN_MS = 0.5;
const MAX_MS = 2.5;
// ==================

function degToMs(deg) {
  return MIN_MS + (deg / 180) * (MAX_MS - MIN_MS);
}

function moveToAngle(pwm, ch, deg) {
  const ms = degToMs(deg);
  pwm.setPulseLength(ch, ms * 1000); // microseconds
  console.log(`🦾 CH${ch} → ${deg}° (${ms.toFixed(3)} ms)`);
}

// ---- INIT ----
const i2cBus = i2c.openSync(I2C_BUS);

const pwm = new Pca9685Driver(
  {
    i2c: i2cBus,
    address: PCA_ADDR,
    frequency: FREQ,
  },
  (err) => {
    if (err) {
      console.error('❌ PCA9685 init failed', err);
      process.exit(1);
    }

    console.log('✅ PCA9685 ready');
    console.log('🔒 Holding servos (PWM active)');
    console.log('👉 Commands: -n <ch> -d <deg>');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    rl.prompt();

    rl.on('line', (line) => {
      const args = line.trim().split(/\s+/);

      const nIdx = args.indexOf('-n');
      const dIdx = args.indexOf('-d');

      if (nIdx === -1 || dIdx === -1) {
        console.log('❌ Usage: -n <ch> -d <deg>');
        rl.prompt();
        return;
      }

      const ch = Number(args[nIdx + 1]);
      const deg = Number(args[dIdx + 1]);

      if (Number.isNaN(ch) || Number.isNaN(deg)) {
        console.log('❌ Invalid numbers');
        rl.prompt();
        return;
      }

      moveToAngle(pwm, ch, deg);
      rl.prompt();
    });
  }
);

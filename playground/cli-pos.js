#!/usr/bin/env node

import i2c from 'i2c-bus';
import { Pca9685Driver } from 'pca9685';

// ================= CONFIG =================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

// calibrated for YOUR MG996R setup
const CENTER_MS = 1.5;
const MS_PER_DEGREE = 1.0 / 120;

const MIN_MS = 0.5;
const MAX_MS = 2.5;
// ==========================================

// ---------- Positions ----------
const POSITIONS = {
  pos1: {
    1: 90,  // base
    2: 0,   // shoulder
    3: 90,  // elbow
    4: 90,  // wrist
    // future positions go here
  },
};

// ---------- CLI ----------
const args = process.argv.slice(2);
const posName = args[0];

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? Number(args[i + 1]) : null;
}

// ---------- Helpers ----------
function degToMs(deg) {
  return Math.min(
    MAX_MS,
    Math.max(MIN_MS, CENTER_MS + deg * MS_PER_DEGREE)
  );
}

function moveToAngle(pwm, channel, deg) {
  const ms = degToMs(deg);
  pwm.setPulseRange(channel, 0, ms);
  console.log(`🦾 CH${channel} → ${deg}° (${ms.toFixed(3)} ms)`);
}

// ---------- Init ----------
const i2cBus = i2c.openSync(I2C_BUS);

const pwm = new Pca9685Driver(
  {
    i2c: i2cBus,
    address: PCA_ADDR,
    frequency: FREQ,
    debug: false,
  },
  (err) => {
    if (err) {
      console.error('❌ PCA9685 init failed', err);
      process.exit(1);
    }

    console.log('✅ PCA9685 ready');

    // ----- POSITION MODE -----
    if (POSITIONS[posName]) {
      console.log(`📍 Moving to position: ${posName}`);

      const pos = POSITIONS[posName];
      for (const ch of Object.keys(pos)) {
        moveToAngle(pwm, Number(ch), pos[ch]);
      }

    // ----- ABS MODE (cli-abs compatible) -----
    } else {
      const ch = getArg('-n');
      const deg = getArg('-d');

      if (ch == null || deg == null) {
        console.error('❌ Usage: cli-pos.js pos1  OR  -n <ch> -d <deg>');
        process.exit(1);
      }

      moveToAngle(pwm, ch, deg);
    }

    // 🔒 IMPORTANT PART 🔒
    console.log('🔒 Holding position (PWM active). Press Ctrl+C to release.');

    // keep Node alive → PWM keeps running → servos hold torque
    setInterval(() => {}, 1000);
  }
);

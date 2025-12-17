#!/usr/bin/env node

import i2c from 'i2c-bus';
import { Pca9685Driver } from 'pca9685';
import readline from 'readline';

// ================= CONFIG =================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

const MIN_MS = 0.5;
const MAX_MS = 2.5;
const CENTER_MS = 1.5;
const MS_PER_DEGREE = 1.0 / 120;
// ==========================================

// ---------- Positions ----------
const POSITIONS = {
  pos1: {
    1: 90,
    2: 0,
    3: 90,
    4: 90,
  },
};

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

function applyPosition(pwm, name) {
  const pos = POSITIONS[name];
  if (!pos) {
    console.log(`❌ Unknown position: ${name}`);
    return;
  }

  console.log(`📍 Moving to position: ${name}`);
  for (const ch of Object.keys(pos)) {
    moveToAngle(pwm, Number(ch), pos[ch]);
  }
}

// ---------- Init ----------
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

    // apply initial position if provided
    const initial = process.argv[2];
    if (initial) {
      applyPosition(pwm, initial);
    }

    console.log('🔒 Holding position (PWM active)');
    console.log('👉 Enter commands: pos1 | -n <ch> -d <deg>');

    // ---------- Interactive input ----------
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    rl.prompt();

    rl.on('line', (line) => {
      const args = line.trim().split(/\s+/);

      if (args[0].startsWith('pos')) {
        applyPosition(pwm, args[0]);
      } else if (args[0] === '-n') {
        const ch = Number(args[1]);
        const dIndex = args.indexOf('-d');
        const deg = dIndex !== -1 ? Number(args[dIndex + 1]) : null;

        if (ch && deg !== null) {
          moveToAngle(pwm, ch, deg);
        } else {
          console.log('❌ Usage: -n <ch> -d <deg>');
        }
      } else {
        console.log('❓ Unknown command');
      }

      rl.prompt();
    });
  }
);

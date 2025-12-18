import { setTimeout as wait } from "node:timers/promises";
import {
  clamp,
  msToTicks,
  openPca9685,
  setServoPulseRangeMs,
} from "../src/servos.js";

// ================== CONFIG ==================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const FREQ = 50;

// Channels to test (1–6, no 0)
// const CHANNELS = [1, 2, 3, 4, 5, 6];
const CHANNELS = [1];

// Servo calibration
const CENTER_MS = 1.5;
const MS_PER_DEGREE = 1.0 / 120; // stronger than 1/180

// Safety limits
const MIN_MS = 1.2;
const MAX_MS = 1.8;

// Test angle
const TEST_DEG = 5;
// ============================================

function moveByDegrees(pwm, channel, deg) {
  const targetMs = CENTER_MS + deg * MS_PER_DEGREE;
  const safeMs = clamp(targetMs, MIN_MS, MAX_MS);
  const ticks = msToTicks(safeMs);

  console.log(
    `🦾 CH${channel} → ${deg}° → ${safeMs.toFixed(3)} ms → ${ticks} ticks`
  );

  setServoPulseRangeMs(pwm, channel, safeMs, { frequencyHz: FREQ });
}

// ============================================

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

    console.log("✅ PCA9685 ready");
    console.log("🔁 Testing channels 1 → 6 (±30°)");
    console.log("");

    try {
      for (const ch of CHANNELS) {
        console.log(`\n▶ Testing channel ${ch}`);

        moveByDegrees(pwm, ch, 0);
        await wait(1200);

        moveByDegrees(pwm, ch, -TEST_DEG);
        await wait(1200);

        moveByDegrees(pwm, ch, +TEST_DEG);
        await wait(1200);

        moveByDegrees(pwm, ch, 0);
        await wait(1400); // total ≈ 5s per channel
      }

      console.log("\n✅ Channel sweep completed");
    } catch (e) {
      console.error("💥 Runtime error:", e);
    } finally {
      console.log("🛑 Shutting down");
      process.exit(0);
    }
  }
);

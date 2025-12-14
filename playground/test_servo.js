import i2c from "i2c-bus";
import { setTimeout as wait } from "node:timers/promises";
import { Pca9685Driver } from "pca9685";

// ================== CONFIG ==================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const CHANNEL = 0;
const FREQ = 50;

// Servo pulse lengths (milliseconds)
const CENTER_MS = 1.5;
const MIN_MS = 1.3;
const MAX_MS = 1.7;

// ============================================

function msToTicks(ms) {
  const periodMs = 1000 / FREQ; // 20ms at 50Hz
  return Math.round((ms / periodMs) * 4096);
}

console.log("🔧 Opening I2C bus...");
const i2cBus = i2c.openSync(I2C_BUS);

const pwm = new Pca9685Driver(
  {
    i2c: i2cBus,
    address: PCA_ADDR,
    frequency: FREQ,
    debug: false,
  },
  async (err) => {
    if (err) {
      console.error("❌ PCA9685 init failed:", err);
      process.exit(1);
    }

    console.log("✅ PCA9685 ready");
    console.log(`📡 Channel ${CHANNEL}`);
    console.log("");

    try {
      const center = msToTicks(CENTER_MS);
      const min = msToTicks(MIN_MS);
      const max = msToTicks(MAX_MS);

      console.log(`🎯 Centering (${CENTER_MS} ms → ${center} ticks)`);
      pwm.setPulseRange(CHANNEL, 0, center);
      await wait(1500);

      console.log(`↙ MIN (${MIN_MS} ms → ${min} ticks)`);
      pwm.setPulseRange(CHANNEL, 0, min);
      await wait(1200);

      console.log(`↗ MAX (${MAX_MS} ms → ${max} ticks)`);
      pwm.setPulseRange(CHANNEL, 0, max);
      await wait(1200);

      console.log("🎯 Back to center");
      pwm.setPulseRange(CHANNEL, 0, center);
      await wait(1200);

      console.log("✅ Servo test completed safely");
    } catch (e) {
      console.error("💥 Runtime error:", e);
    } finally {
      console.log("🛑 Shutting down");
      process.exit(0);
    }
  }
);

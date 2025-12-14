import i2c from "i2c-bus";
import { setTimeout as wait } from "node:timers/promises";
import { Pca9685Driver } from "pca9685";

// ================== CONFIG ==================
const I2C_BUS = 1;
const PCA_ADDR = 0x40;
const SERVO_CHANNEL = 0;     // only ONE servo connected
const SERVO_FREQ = 50;       // Hz

// Safe pulse range (milliseconds)
const SERVO_CENTER = 1.5;
const SERVO_MIN = 1.3;       // small movement only
const SERVO_MAX = 1.7;

// ============================================

console.log("🔧 Opening I2C bus...");
const i2cBus = i2c.openSync(I2C_BUS);

const options = {
  i2c: i2cBus,
  address: PCA_ADDR,
  frequency: SERVO_FREQ,
  debug: false,
};

console.log("🔌 Initializing PCA9685...");

const pwm = new Pca9685Driver(options, async (err) => {
  if (err) {
    console.error("❌ PCA9685 init failed:", err);
    process.exit(1);
  }

  console.log("✅ PCA9685 ready");
  console.log(`📡 Channel: ${SERVO_CHANNEL}`);
  console.log("⚠️ Make sure ONLY ONE servo is connected");
  console.log("⚠️ External 5–6V power connected to the HAT");
  console.log("");

  try {
    // --- Center first ---
    console.log("🎯 Centering servo (1.5 ms)");
    pwm.setPulseLength(SERVO_CHANNEL, SERVO_CENTER);
    await wait(1500);

    // --- Small move left ---
    console.log("↙ Moving to safe MIN (1.3 ms)");
    pwm.setPulseLength(SERVO_CHANNEL, SERVO_MIN);
    await wait(1200);

    // --- Small move right ---
    console.log("↗ Moving to safe MAX (1.7 ms)");
    pwm.setPulseLength(SERVO_CHANNEL, SERVO_MAX);
    await wait(1200);

    // --- Back to center ---
    console.log("🎯 Returning to center");
    pwm.setPulseLength(SERVO_CHANNEL, SERVO_CENTER);
    await wait(1200);

    console.log("✅ Servo test completed safely");
  } catch (e) {
    console.error("💥 Runtime error:", e);
  } finally {
    console.log("🛑 Shutting down");
    process.exit(0);
  }
});

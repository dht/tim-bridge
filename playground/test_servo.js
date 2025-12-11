import { Pca9685Driver } from "pca9685";
import { setTimeout as wait } from "node:timers/promises";

const options = {
  i2c: require("i2c-bus").openSync(1), // Bus 1 on Pi
  address: 0x40,                       // Default PCA9685 I2C address
  frequency: 50,                       // 50Hz for servos
  debug: false
};

const channel = 0; // your servo's channel

const pwm = new Pca9685Driver(options, async (err) => {
  if (err) {
    console.error("❌ PCA9685 init failed:", err);
    process.exit(1);
  }

  console.log("✅ PCA9685 ready. Moving servo...");

  // Helper: convert angle → duty cycle
  function angleToDuty(angle) {
    // MG996R typical: 0° = 0.5ms, 180° = 2.5ms
    const min = 0.5; // ms
    const max = 2.5; // ms
    const pulse = min + ((max - min) * angle) / 180;
    return pulse; // pca9685 library expects pulse in milliseconds
  }

  // Move to 0°
  pwm.setPulseLength(channel, angleToDuty(0));
  console.log("→ 0°");
  await wait(1000);

  // Move to 90°
  pwm.setPulseLength(channel, angleToDuty(90));
  console.log("→ 90°");
  await wait(1000);

  // Move to 180°
  pwm.setPulseLength(channel, angleToDuty(180));
  console.log("→ 180°");
  await wait(1000);

  console.log("Done.");
  process.exit(0);
});

// led.js — safe for Mac & Raspberry Pi

let rpio = null;

async function loadRpio() {
  const isPi =
    process.platform === "linux" &&
    (process.arch === "arm" || process.arch === "arm64");

  if (!isPi) {
    console.log("⚠️ Running on non-Pi system: RGB LED disabled.");
    return null;
  }

  try {
    const module = await import("rpio");
    module.default.init({ gpiomem: true });
    console.log("GPIO ready (RGB).");
    return module.default;
  } catch (err) {
    console.log("⚠️ Failed to load rpio for RGB:", err.message);
    return null;
  }
}

const rpioPromise = loadRpio();

// Pins (physical)
const RED = 32;
const GREEN = 33;
const BLUE = 12;

function simulate(pin, on) {
  console.log(`(simulate RGB) pin ${pin} = ${on ? "ON" : "OFF"}`);
}

async function on(pin) {
  const rpio = await rpioPromise;
  if (!rpio) return simulate(pin, true);

  rpio.open(pin, rpio.OUTPUT, rpio.LOW);
  rpio.write(pin, rpio.LOW); // common-anode logic
}

async function off(pin) {
  const rpio = await rpioPromise;
  if (!rpio) return simulate(pin, false);

  rpio.open(pin, rpio.OUTPUT, rpio.LOW);
  rpio.write(pin, rpio.HIGH);
}

export async function allOff() {
  await off(RED);
  await off(GREEN);
  await off(BLUE);
}

let currentStatus = null;

export async function setStatus(mode) {
  currentStatus = mode;

  await allOff();

  switch (mode) {
    case "IDLE":
      await on(GREEN);
      break;

    case "GENERATING":
      await on(BLUE);
      break;

    case "LISTENING":
      await on(BLUE);
      break;

    case "PLAYBACK":
      await on(RED);
      break;

    default:
      await allOff();
  }
}

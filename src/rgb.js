// led.js — updated patterns for RGB

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
  rpio.write(pin, rpio.LOW); // common-anode low = ON
}

async function off(pin) {
  const rpio = await rpioPromise;
  if (!rpio) return simulate(pin, false);

  rpio.open(pin, rpio.OUTPUT, rpio.LOW);
  rpio.write(pin, rpio.HIGH); // OFF
}

export async function allOff() {
  await off(RED);
  await off(GREEN);
  await off(BLUE);
}

// ---- patterns ----

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function blink(pin, onMs, offMs, cycles = 20) {
  for (let i = 0; i < cycles; i++) {
    await on(pin);
    await sleep(onMs);
    await off(pin);
    await sleep(offMs);
  }
}

async function alternate(pinA, pinB, speed = 150, cycles = 20) {
  for (let i = 0; i < cycles; i++) {
    await on(pinA);
    await off(pinB);
    await sleep(speed);

    await on(pinB);
    await off(pinA);
    await sleep(speed);
  }
}

let currentStatus = null;
let effectController = 0;

// Cancels running patterns when mode changes
async function newEffect(fn) {
  effectController++;
  const myId = effectController;
  await allOff();
  fn(async () => myId !== effectController);
}

// ------------ MAIN STATUS LOGIC -------------

export async function setStatus(mode) {
  currentStatus = mode;

  switch (mode) {
    case "GENERATING":
      // slow blue pulse
      return newEffect(async cancelled => {
        while (!cancelled()) {
          await on(BLUE);
          await sleep(200);
          await off(BLUE);
          await sleep(300);
        }
      });

    case "READY":
      // very fast green blink
      return newEffect(async cancelled => {
        while (!cancelled()) {
          await on(GREEN);
          await sleep(70);
          await off(GREEN);
          await sleep(70);
        }
      });

    case "PLAYBACK":
      // solid blue
      return newEffect(async cancelled => {
        await on(BLUE);
        while (!cancelled()) await sleep(200);
      });

    case "DONE":
      // very fast blue blink
      return newEffect(async cancelled => {
        while (!cancelled()) {
          await on(BLUE);
          await sleep(60);
          await off(BLUE);
          await sleep(60);
        }
      });

    case "RESETTING":
      // alternate green ↔ blue
      return newEffect(async cancelled => {
        while (!cancelled()) {
          await alternate(GREEN, BLUE, 150, 4);
        }
      });

    case "ERROR":
      // solid red
      return newEffect(async cancelled => {
        await on(RED);
        while (!cancelled()) await sleep(200);
      });

    default:
      await allOff();
  }
}

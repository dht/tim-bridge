import rpio from 'rpio';

rpio.init({ gpiomem: false }); // using full /dev/mem for PWM if needed

const RED   = 32;
const GREEN = 33;
const BLUE  = 12;

// Common anode: HIGH = off, LOW = on
function on(pin)  { rpio.write(pin, rpio.LOW); }
function off(pin) { rpio.write(pin, rpio.HIGH); }

function allOff() {
  off(RED); off(GREEN); off(BLUE);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------- EFFECTS ----------
async function steadyGreen() {
  allOff();
  on(GREEN);
}

async function slowBlinkGreen() {
  allOff();
  while (currentStatus === "generating") {
    on(GREEN);  await sleep(600);
    off(GREEN); await sleep(600);
  }
}

async function doubleBlinkGreen() {
  allOff();
  while (currentStatus === "listening") {
    for (let i = 0; i < 2; i++) {
      on(GREEN);  await sleep(150);
      off(GREEN); await sleep(150);
    }
    await sleep(500);
  }
}

async function steadyBlue() {
  allOff();
  on(BLUE);
}

async function steadyRed() {
  allOff();
  on(RED);
}

async function blinkRed() {
  allOff();
  while (currentStatus === "error-no-internet") {
    on(RED);  await sleep(400);
    off(RED); await sleep(400);
  }
}

async function doubleBlinkRed() {
  allOff();
  while (currentStatus === "error-reset-fail") {
    for (let i = 0; i < 2; i++) {
      on(RED);  await sleep(150);
      off(RED); await sleep(150);
    }
    await sleep(600);
  }
}

async function tripleBlinkRed() {
  allOff();
  while (currentStatus === "error-generation-fail") {
    for (let i = 0; i < 3; i++) {
      on(RED);  await sleep(150);
      off(RED); await sleep(150);
    }
    await sleep(600);
  }
}

// ---------- STATE SYSTEM ----------
let currentStatus = null;

export async function setStatus(mode) {
  currentStatus = mode;
  allOff();

  switch (mode) {
    case "idle":                return steadyGreen();
    case "generating":         return slowBlinkGreen();
    case "listening":           return doubleBlinkGreen();
    case "speaking":            return steadyBlue();

    case "error":               return steadyRed();
    case "error-no-internet":   return blinkRed();
    case "error-reset-fail":    return doubleBlinkRed();
    case "error-generation-fail": return tripleBlinkRed();

    default:
      console.error("Unknown status:", mode);
      return allOff();
  }
}

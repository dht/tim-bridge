import rpio from 'rpio';

// Use /dev/gpiomem so GPIO works without sudo (user just needs to be in the gpio group)
rpio.init({ gpiomem: true });

const RED   = 32;
const GREEN = 33;
const BLUE  = 12;

// Common anode logic
function on(pin)  { rpio.write(pin, rpio.LOW); }
function off(pin) { rpio.write(pin, rpio.HIGH); }

export function allOff() {
  off(RED); off(GREEN); off(BLUE);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function dimAllColors() {
  // no PWM – simulate dim by short ON pulses
  for (let i = 0; i < 40; i++) {
    on(RED); on(GREEN); on(BLUE);
    await sleep(10);
    off(RED); off(GREEN); off(BLUE);
    await sleep(40);
  }
  allOff();
}

// ---------------- Patterns ------------------

async function steadyGreen() {
  allOff(); on(GREEN);
}

async function slowBlinkGreen() {
  allOff();
  while (currentStatus === "generating") {
    on(GREEN);  await sleep(900);   // calmer ON
    off(GREEN); await sleep(900);   // calmer OFF
  }
}

async function doubleBlinkGreen() {
  allOff();
  while (currentStatus === "listening") {
    for (let i = 0; i < 2; i++) {
      on(GREEN);  await sleep(250);  // slow, calm
      off(GREEN); await sleep(250);
    }
    await sleep(800); // relax pause
  }
}

async function steadyBlue() {
  allOff(); on(BLUE);
}

async function steadyRed() {
  allOff(); on(RED);
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
      on(RED);  await sleep(200);
      off(RED); await sleep(200);
    }
    await sleep(700);
  }
}

async function tripleBlinkRed() {
  allOff();
  while (currentStatus === "error-generation-fail") {
    for (let i = 0; i < 3; i++) {
      on(RED);  await sleep(200);
      off(RED); await sleep(200);
    }
    await sleep(700);
  }
}

// ---------------- Dispatcher ------------------

let currentStatus = null;

export async function setStatus(mode) {
  currentStatus = mode;
  allOff();

  switch (mode) {
    case "IDLE":                     return steadyGreen();
    case "GENERATING":              return slowBlinkGreen();
    case "LISTENING":               return doubleBlinkGreen();
    case "PLAYBACK":                return steadyBlue();
    case "RESETTING":               return steadyBlue();
    
    case "error":                   return steadyRed();
    case "error-no-internet":       return blinkRed();
    case "error-reset-fail":        return doubleBlinkRed();
    case "error-generation-fail":   return tripleBlinkRed();
  }
}

// ---------------- Cleanup on Exit ------------------

let cleaning = false;

async function cleanup() {
  if (cleaning) return;
  cleaning = true;

  console.log("\nCleaning up… dimming all colors.");
  await dimAllColors();

  allOff();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

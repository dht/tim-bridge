import rpio from 'rpio';

// --- Enable full hardware PWM access ---
rpio.init({
  mapping: 'gpio',
  gpiomem: false,   // required for hardware PWM
});

// --- HARDWARE PWM PINS ---
// RED   → GPIO18 (PWM0)
// GREEN → GPIO13 (PWM1)
// BLUE  → GPIO12 (PWM0 ALT)
const RED   = 18;
const GREEN = 13;
const BLUE  = 12;

// --- Setup pins for hardware PWM ---
rpio.open(RED,   rpio.PWM);
rpio.open(GREEN, rpio.PWM);
rpio.open(BLUE,  rpio.PWM);

// --- PWM precision ---
const RANGE = 1024;
rpio.pwmSetRange(RED, RANGE);
rpio.pwmSetRange(GREEN, RANGE);
rpio.pwmSetRange(BLUE, RANGE);

// Smooth hardware PWM clock
rpio.pwmSetClockDivider(32);

// Utility sleep
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- COMMON ANODE: invert output (0 = bright, 1024 = off) ---
function invert(v) {
  return RANGE - v; // 1024 - value
}

// Write RGB in PWM 0–1024 (inverted for anode)
function writeRGB(r, g, b) {
  rpio.pwmSetData(RED,   invert(r));
  rpio.pwmSetData(GREEN, invert(g));
  rpio.pwmSetData(BLUE,  invert(b));
}

// Convert 0–255 color × scale → 0–1024
function colorToPWM([r, g, b], scale = 1) {
  return [r, g, b].map(c => Math.round(c * scale * RANGE / 255));
}

// Easing
const ease = t => 0.5 * (1 - Math.cos(Math.PI * t));

// ---------------- PATTERNS ----------------
async function breathing(color, period = 3000) {
  while (true) {
    for (let t = 0; t < 1; t += 0.02) {
      const s = 0.15 + 0.7 * ease(t);
      writeRGB(...colorToPWM(color, s));
      await sleep(period / 50);
    }
  }
}

async function pulse(color, period = 1000) {
  while (true) {
    for (let t = 0; t < 1; t += 0.04) {
      writeRGB(...colorToPWM(color, 0.3 + 0.7 * ease(t)));
      await sleep(period / 25);
    }
  }
}

async function blink(color, period = 2000, duty = 0.1) {
  const onTime = period * duty;
  while (true) {
    writeRGB(...colorToPWM(color));
    await sleep(onTime);
    writeRGB(0, 0, 0);
    await sleep(period - onTime);
  }
}

async function doubleBlink(color) {
  while (true) {
    for (let i = 0; i < 2; i++) {
      writeRGB(...colorToPWM(color));
      await sleep(80);
      writeRGB(0, 0, 0);
      await sleep(120);
    }
    await sleep(1000);
  }
}

// ---------------- STATE HANDLER ----------------
export async function setState(state) {
  writeRGB(0, 0, 0);

  const c = {
    idle:       [0, 200, 160],
    generating: [255, 0, 180],
    listening:  [0, 180, 255],
    speaking:   [255, 160, 0],
    error:      [255, 32, 32],
  };

  switch (state.toUpperCase()) {
    case 'IDLE':             return breathing(c.idle);
    case 'GENERATING':       return pulse(c.generating);
    case 'LISTENING':        return blink(c.listening);
    case 'ERROR-NOINTERNET': return doubleBlink(c.error);
    default:
      writeRGB(0, 0, 0);
  }
}

//NOTES: run it with which node
// sudo node-location file-js


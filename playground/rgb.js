import rpio from "rpio";

// PWM pins for Raspberry Pi 4
const RED = 12;    // physical pin 12  -> GPIO18 (PWM0)
const GREEN = 32;  // physical pin 32  -> GPIO12 (PWM0)
const BLUE = 33;   // physical pin 33  -> GPIO13 (PWM1)

// For a common-anode LED: HIGH = OFF, LOW = ON
const OFF = 255;
const ON = 0;

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function initPins() {
  rpio.init({ gpiomem: false });

  // Set each RGB pin to PWM mode
  rpio.open(RED, rpio.PWM);
  rpio.open(GREEN, rpio.PWM);
  rpio.open(BLUE, rpio.PWM);

  // Set PWM ranges (0–255)
  rpio.pwmSetRange(RED, 255);
  rpio.pwmSetRange(GREEN, 255);
  rpio.pwmSetRange(BLUE, 255);

  // Set PWM clock divider (slows signal to avoid flicker)
  rpio.pwmSetClockDivider(64);
}

function allOff() {
  rpio.pwmSetData(RED, OFF);
  rpio.pwmSetData(GREEN, OFF);
  rpio.pwmSetData(BLUE, OFF);
}

async function showColor(name, r, g, b, ms = 2000) {
  console.log(`\n=== Showing ${name} ===`);
  console.log({ red: r, green: g, blue: b });

  rpio.pwmSetData(RED, r);
  rpio.pwmSetData(GREEN, g);
  rpio.pwmSetData(BLUE, b);

  await sleep(ms);
}

async function main() {
  initPins();
  allOff();
  console.log("Starting RGB PWM test…");

  // Common-Anode LED → lower value = brighter
  await showColor("RED",   ON,   OFF,  OFF);
  await showColor("GREEN", OFF,  ON,   OFF);
  await showColor("BLUE",  OFF,  OFF,  ON);

  console.log("\nDone. Turning everything off.");
  allOff();
  process.exit(0);
}

main();

import rpio from "rpio";

// your confirmed physical pins:
const RED   = 32;  // GPIO12  (PWM0)
const GREEN = 33;  // GPIO13  (PWM1)
const BLUE  = 12;  // GPIO18  (PWM0)

// common-anode LED values
const ON  = 0;     // full brightness
const OFF = 255;   // off

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function initPins() {
  rpio.init({ mapping: 'physical', gpiomem: false });

  // open pins as PWM
  rpio.open(RED, rpio.PWM);
  rpio.open(GREEN, rpio.PWM);
  rpio.open(BLUE, rpio.PWM);

  // range for smooth 8-bit colors
  rpio.pwmSetRange(RED, 255);
  rpio.pwmSetRange(GREEN, 255);
  rpio.pwmSetRange(BLUE, 255);

  // clock divider (must be power of 2)
  rpio.pwmSetClockDivider(64);
}

function setColor(r, g, b) {
  rpio.pwmSetData(RED, r);
  rpio.pwmSetData(GREEN, g);
  rpio.pwmSetData(BLUE, b);
}

async function showColor(name, r, g, b) {
  console.log(`Showing ${name}`, {r, g, b});
  setColor(r, g, b);
  await sleep(1500);
}

function cleanup() {
  console.log("Cleaning up…");
  setColor(OFF, OFF, OFF);
  process.exit(0);
}

async function main() {
  initPins();

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  while (true) {
    await showColor("RED",   ON, OFF, OFF);
    await showColor("GREEN", OFF, ON, OFF);
    await showColor("BLUE",  OFF, OFF, ON);
  }
}

main();

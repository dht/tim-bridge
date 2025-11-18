import rpio from "rpio";

// Updated pin selection (no channel conflicts)
const RED = 11;    // GPIO17 - software PWM
const GREEN = 12;  // GPIO18 - hardware PWM (PWM0)
const BLUE = 13;   // GPIO27 - software PWM

// Common-anode LED → HIGH = OFF, LOW = ON
const OFF = 255;
const ON = 0;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function initPins() {
  rpio.init({ gpiomem: false });

  rpio.open(RED, rpio.PWM);
  rpio.open(GREEN, rpio.PWM);
  rpio.open(BLUE, rpio.PWM);

  rpio.pwmSetRange(RED, 255);
  rpio.pwmSetRange(GREEN, 255);
  rpio.pwmSetRange(BLUE, 255);

  rpio.pwmSetClockDivider(64);
}

function allOff() {
  rpio.pwmSetData(RED, OFF);
  rpio.pwmSetData(GREEN, OFF);
  rpio.pwmSetData(BLUE, OFF);
}

async function showColor(name, r, g, b, ms = 2000) {
  console.log(`\n=== Showing ${name} ===`);
  console.log({ r, g, b });

  rpio.pwmSetData(RED, r);
  rpio.pwmSetData(GREEN, g);
  rpio.pwmSetData(BLUE, b);

  await sleep(ms);
}

async function main() {
  initPins();

  console.log("Starting RGB LED loop...");

  while (true) {
    await showColor("RED",   ON,   OFF,  OFF);  // bright red
    await showColor("GREEN", OFF,  ON,   OFF);  // bright green
    await showColor("BLUE",  OFF,  OFF,  ON);   // bright blue
  }
}

main();

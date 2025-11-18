import rpio from "rpio";

// All three are hardware PWM pins
const RED   = 32;  // GPIO12  (PWM0)
const GREEN = 33;  // GPIO13  (PWM1)
const BLUE  = 12;  // GPIO18  (PWM0)

// common-anode logic
const OFF = 255;
const ON  = 0;

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

  // global to all channels, must be power-of-two
  rpio.pwmSetClockDivider(64);
}

function setColor(r, g, b) {
  rpio.pwmSetData(RED, r);
  rpio.pwmSetData(GREEN, g);
  rpio.pwmSetData(BLUE, b);
}

async function main() {
  initPins();

  process.on("SIGINT", () => {
    console.log("cleanup…");
    setColor(OFF, OFF, OFF);
    process.exit(0);
  });

  while (true) {
    console.log("RED");
    setColor(ON, OFF, OFF);
    await sleep(1500);

    console.log("GREEN");
    setColor(OFF, ON, OFF);
    await sleep(1500);

    console.log("BLUE");
    setColor(OFF, OFF, ON);
    await sleep(1500);
  }
}

main();

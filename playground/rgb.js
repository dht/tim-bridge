import rpio from "rpio";

const RED   = 11; // GPIO17 (software PWM)
const GREEN = 12; // GPIO18 (hardware PWM)
const BLUE  = 13; // GPIO27 (software PWM)

const OFF = 255;
const ON  = 0;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function initPins() {
  rpio.init({ gpiomem: false });

  // RED → software PWM
  rpio.open(RED, rpio.OUTPUT, rpio.HIGH);

  // GREEN → hardware PWM
  rpio.open(GREEN, rpio.PWM);
  rpio.pwmSetRange(GREEN, 255);
  rpio.pwmSetClockDivider(GREEN, 64);

  // BLUE → software PWM
  rpio.open(BLUE, rpio.OUTPUT, rpio.HIGH);
}

function setSoftwarePWM(pin, value) {
  // value 0–255, but software PWM is simulated using duty cycles
  const duty = value / 255;

  let isOn = false;
  let interval = setInterval(() => {
    rpio.write(pin, isOn ? rpio.HIGH : rpio.LOW);
    isOn = !isOn;
  }, 2 * duty + 1);

  return interval;
}

let redPWM = null;
let bluePWM = null;

function setColor(r, g, b) {
  // Stop previous software PWM
  if (redPWM) clearInterval(redPWM);
  if (bluePWM) clearInterval(bluePWM);

  // RED and BLUE → software PWM
  redPWM = setSoftwarePWM(RED, r);
  bluePWM = setSoftwarePWM(BLUE, b);

  // GREEN → hardware PWM
  rpio.pwmSetData(GREEN, g);
}

async function showColor(name, r, g, b, ms = 2000) {
  console.log(`\n=== Showing ${name} ===`);
  console.log({ r, g, b });
  setColor(r, g, b);
  await sleep(ms);
}

function cleanup() {
  console.log("\nCleaning up…");

  clearInterval(redPWM);
  clearInterval(bluePWM);

  // Default color: all OFF
  rpio.write(RED, rpio.HIGH);
  rpio.pwmSetData(GREEN, OFF);
  rpio.write(BLUE, rpio.HIGH);

  console.log("LED reset. Exiting.");

  process.exit(0);
}

async function main() {
  initPins();

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  console.log("Starting RGB LED loop…");

  while (true) {
    await showColor("RED",   ON,   OFF,  OFF);
    await showColor("GREEN", OFF,  ON,   OFF);
    await showColor("BLUE",  OFF,  OFF,  ON);
  }
}

main();

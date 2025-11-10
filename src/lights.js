import rpio from 'rpio';

rpio.init({ mapping: 'physical' }); // your LED_PIN=11 is physical, not GPIO

const LED1 = 11; // first LED (pin 11 = GPIO 17)
const LED2 = 13; // second LED (pin 13 = GPIO 27)

// helper: wait for ms milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flashLights(times = 5, delay = 500) {
  console.log(`💡 Starting to flash lights ${times} times...`);
  rpio.open(LED1, rpio.OUTPUT, rpio.LOW);
  rpio.open(LED2, rpio.OUTPUT, rpio.LOW);

  for (let i = 0; i < times; i++) {
    rpio.write(LED1, rpio.HIGH);
    rpio.write(LED2, rpio.HIGH);
    await sleep(delay);
    rpio.write(LED1, rpio.LOW);
    rpio.write(LED2, rpio.LOW);
    await sleep(delay);
  }

  rpio.close(LED1);
  rpio.close(LED2);
  console.log('✅ Done flashing lights.');
}

export function turnLightsOn() {
  console.log('💡 Turning lights ON');
  rpio.open(LED1, rpio.OUTPUT, rpio.LOW);
  rpio.open(LED2, rpio.OUTPUT, rpio.LOW);
  rpio.write(LED1, rpio.HIGH);
  rpio.write(LED2, rpio.HIGH);
}

export function turnLightsOff() {
  console.log('💤 Turning lights OFF');
  rpio.open(LED1, rpio.OUTPUT, rpio.LOW);
  rpio.open(LED2, rpio.OUTPUT, rpio.LOW);
  rpio.write(LED1, rpio.LOW);
  rpio.write(LED2, rpio.LOW);
}

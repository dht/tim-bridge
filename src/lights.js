import rpio from 'rpio';

const LED_PIN = 17; // GPIO 17 (pin 11)

// helper: wait for ms milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flashLights(times = 5, delay = 500) {
  console.log(`💡 Starting to flash lights ${times} times...`);
  rpio.open(LED_PIN, rpio.OUTPUT, rpio.LOW);

  for (let i = 0; i < times; i++) {
    rpio.write(LED_PIN, rpio.HIGH); // turn on
    await sleep(delay);
    rpio.write(LED_PIN, rpio.LOW); // turn off
    await sleep(delay);
  }

  rpio.close(LED_PIN); // release the pin
  console.log('✅ Done flashing lights.');
}

export function turnLightsOn() {
  console.log('💡 Turning light ON');
  rpio.open(LED_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.write(LED_PIN, rpio.HIGH);
}

export function turnLightsOff() {
  console.log('💤 Turning light OFF');
  rpio.open(LED_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.write(LED_PIN, rpio.LOW);
}

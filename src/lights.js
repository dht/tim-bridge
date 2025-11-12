import rpio from 'rpio';

rpio.init({ mapping: 'physical' }); // using physical pin numbering

// helper: wait for ms milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flashLights(times = 5, delay = 500) {
  console.log(`💡 Flashing both LEDs ${times} times...`);
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

/**
 * Turn one or more LEDs ON
 * @param {number|number[]} leds - LED pin number(s), e.g. 11 or [11, 13]
 */
export function turnLightsOn(leds) {
  const pins = Array.isArray(leds) ? leds : [leds];
  for (const pin of pins) {
    rpio.open(pin, rpio.OUTPUT, rpio.LOW);
    rpio.write(pin, rpio.HIGH);
    console.log(`💡 LED on pin ${pin} turned ON`);
  }
}

/**
 * Turn one or more LEDs OFF
 * @param {number|number[]} leds - LED pin number(s), e.g. 11 or [11, 13]
 */
export function turnLightsOff(leds) {
  const pins = Array.isArray(leds) ? leds : [leds];
  for (const pin of pins) {
    rpio.open(pin, rpio.OUTPUT, rpio.LOW);
    rpio.write(pin, rpio.LOW);
    console.log(`💤 LED on pin ${pin} turned OFF`);
  }
}

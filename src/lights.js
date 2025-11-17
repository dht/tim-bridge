import rpio from 'rpio';

const LED1 = 11;
const LED2 = 13;

rpio.init({ mapping: 'physical' }); // using physical pin numbering

// helper: wait for ms milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

/*
type Options = {
  isLedOneOn: boolean,
  isLedTwoOn: boolean,
}
*/

export function turnLed(pin, isOn) {
  const value = isOn ? rpio.HIGH : rpio.LOW;
  rpio.open(pin, rpio.OUTPUT, rpio.LOW);
  rpio.write(pin, value);
}

export function turnLights(lightStatus) {
  switch (lightStatus) {
    case 'ONE':
      turnLed(LED1, true);
      turnLed(LED2, false);
      break;
    case 'TWO':
      turnLed(LED1, false);
      turnLed(LED2, true);
      break;
    case 'BOTH':
      turnLed(LED1, true);
      turnLed(LED2, true);
      break;
    case 'NONE':
    default:
      turnLed(LED1, false);
      turnLed(LED2, false);
      break;
  }
}

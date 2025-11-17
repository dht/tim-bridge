import rpio from 'rpio';

const LED1 = 11;
const LED2 = 13;

// rpio.init({ mapping: 'physical' }); // using physical pin numbering


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

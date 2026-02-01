export const applyHardware = (fieldId, value, meta) => {
  const { machineId } = meta;

  switch (fieldId) {
    case 'lightStatus':
      turnLights(value);
      break;
  }
};

// lights.js — safe on Mac & Raspberry Pi

let rpio = null;

async function loadRpio() {
  const isPi = process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');

  if (!isPi) {
    return null;
  }

  try {
    const module = await import('rpio');
    module.default.init({ gpiomem: true });
    return module.default;
  } catch (err) {
    console.log('err =>', err);
    return null;
  }
}

const rpioPromise = loadRpio();

function simulate(pin, val) {
  // console.log(pin, val);
}

const LED1 = 11;
const LED2 = 13;

export async function turnLed(pin, isOn) {
  const rpio = await rpioPromise;

  if (!rpio) return simulate(pin, isOn);

  const value = isOn ? rpio.HIGH : rpio.LOW;
  rpio.open(pin, rpio.OUTPUT, rpio.LOW);
  rpio.write(pin, value);
}

export async function turnLights(lightStatus) {
  switch (lightStatus) {
    case 'ONE':
      await turnLed(LED1, true);
      await turnLed(LED2, false);
      break;

    case 'TWO':
      await turnLed(LED1, false);
      await turnLed(LED2, true);
      break;

    case 'BOTH':
      await turnLed(LED1, true);
      await turnLed(LED2, true);
      break;

    default:
      await turnLed(LED1, false);
      await turnLed(LED2, false);
  }
}

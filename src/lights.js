// lights.js — safe on Mac & Raspberry Pi

let rpio = null;

async function loadRpio() {
  const isPi = process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');

  if (!isPi) {
    console.log('⚠️ Running on non-Pi system: GPIO disabled.');
    return null;
  }

  try {
    const module = await import('rpio');
    module.default.init({ gpiomem: true });
    console.log('GPIO ready.');
    return module.default;
  } catch (err) {
    console.log('⚠️ Failed to load rpio:', err.message);
    return null;
  }
}

const rpioPromise = loadRpio();

function simulate(pin, val) {
  console.log(`(simulate GPIO) pin ${pin} <- ${val ? 'ON' : 'OFF'}`);
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
//

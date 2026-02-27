// lights.js - safe on Mac & Raspberry Pi

let rpio = null;

async function loadRpio() {
  const isPi = process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');

  console.log(isPi, process.platform);

  if (!isPi) {
    return null;
  }

  try {
    console.log(1);
    const module = await import('rpio');
    console.log(2);
    module.default.init({ gpiomem: true });
    console.log('rpio module is ready');
    return module.default;
  } catch (err) {
    console.log(err);
    return null;
  }
}

const LED1 = 11;
const LED2 = 13;

export async function turnLed(pin, isOn) {
  const rpio = await loadRpio();

  console.log(typeof rpio);

  const value = isOn ? rpio.HIGH : rpio.LOW;
  console.log('isOn ->', isOn);
  rpio.open(pin, rpio.OUTPUT, rpio.LOW);
  rpio.write(pin, value);
}

export async function turnLights(lightStatus) {
  console.log('lightStatus! ->', lightStatus);
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

async function main() {
  await turnLights('BOTH');
}

main();

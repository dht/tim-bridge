// lights.pi.js - Raspberry Pi GPIO controller
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const HEADER_PIN_TO_GPIO = {
  11: 17,
  13: 27,
};
const DEVICE_MODEL_PATH = '/proc/device-tree/model';

async function canUseBinary(command, args) {
  try {
    await execFileAsync(command, args ?? []);
    return true;
  } catch {
    return false;
  }
}

async function loadBackend() {
  const isPi = process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');

  if (!isPi) {
    return null;
  }

  const deviceModel = fs.existsSync(DEVICE_MODEL_PATH)
    ? fs.readFileSync(DEVICE_MODEL_PATH, 'utf8').replace(/\0/g, '').trim()
    : '';

  if (deviceModel.includes('Raspberry Pi 4')) {
    try {
      const module = await import('rpio');
      module.default.init({ gpiomem: true });
      return { kind: 'rpio', api: module.default };
    } catch (err) {
      console.log('[lights.pi] Raspberry Pi 4 rpio init failed', err);
      return null;
    }
  }

  if (deviceModel.includes('Raspberry Pi 5') && (await canUseBinary('pinctrl', ['help']))) {
    return { kind: 'pinctrl' };
  }

  return null;
}

async function setPinWithPinctrl(pin, isOn) {
  const gpio = HEADER_PIN_TO_GPIO[pin] ?? pin;
  const level = isOn ? 'dh' : 'dl';

  await execFileAsync('pinctrl', ['set', String(gpio), 'op', 'pn', level]);
}

const backendPromise = loadBackend();

function simulate(pin, val) {
  // console.log(pin, val);
}

const LED1 = 11;
const LED2 = 13;

export async function turnLed(pin, isOn) {
  const backend = await backendPromise;

  if (!backend) return simulate(pin, isOn);

  if (backend.kind === 'rpio') {
    const rpio = backend.api;
    const value = isOn ? rpio.HIGH : rpio.LOW;
    rpio.open(pin, rpio.OUTPUT, rpio.LOW);
    rpio.write(pin, value);
    return;
  }

  if (backend.kind === 'pinctrl') {
    await setPinWithPinctrl(pin, isOn);
    return;
  }

  simulate(pin, isOn);
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

export const applyHardware = (fieldId, value, meta) => {
  switch (fieldId) {
    case 'lightStatus':
      turnLights(value);
      break;
    default:
      break;
  }
};

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

console.log(`Ver 1`);


const GPIO = 17;
const POLL_MS = 50;

function readModel() {
  try {
    return fs.readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '').trim();
  } catch {
    return 'Unknown Raspberry Pi';
  }
}

function detectPiFamily(model) {
  const m = model.toLowerCase();

  if (m.includes('raspberry pi zero 2') || m.includes('raspberry pi zero')) {
    return 'pi-zero';
  }

  if (m.includes('raspberry pi 5')) {
    return 'pi-5';
  }

  return 'other';
}

function runPinctrl(args) {
  return execFileSync('pinctrl', args, { encoding: 'utf8' }).trim();
}

function configureInputPullup(pin) {
  // input + pull-up
  runPinctrl(['set', String(pin), 'ip', 'pu']);
}

function readLevel(pin) {
  const out = runPinctrl(['get', String(pin)]);
  // Example:
  // 17: ip pu | hi
  // 17: ip pu | lo
  if (/\blo\b/i.test(out)) return 0;
  if (/\bhi\b/i.test(out)) return 1;
  throw new Error(`Could not parse pinctrl output for GPIO ${pin}: ${out}`);
}

const model = readModel();
const family = detectPiFamily(model);

console.log(`Model: ${model}`);
console.log(`Detected: ${family}`);
console.log(`GPIO: ${GPIO}`);
console.log('Wiring expected: GPIO17 (pin 11) -> button -> GND (pin 6)');
console.log('Using pull-up, so: RELEASED=1, PRESSED=0');
console.log('');

try {
  configureInputPullup(GPIO);
} catch (err) {
  console.error('Failed to configure GPIO with pinctrl.');
  console.error('Try: sudo node test.button.js');
  console.error(err.message);
  process.exit(1);
}

let last = null;

function printState(level) {
  const pressed = level === 0;
  const label = pressed ? 'PRESSED' : 'RELEASED';
  console.log(`${new Date().toISOString()} ${label} (level=${level})`);
}

try {
  last = readLevel(GPIO);
  printState(last);
} catch (err) {
  console.error('Failed to read initial GPIO state.');
  console.error(err.message);
  process.exit(1);
}

const timer = setInterval(() => {
  try {
    const level = readLevel(GPIO);
    if (level !== last) {
      last = level;
      printState(level);
    }
  } catch (err) {
    console.error('Read error:', err.message);
  }
}, POLL_MS);

process.on('SIGINT', () => {
  clearInterval(timer);
  console.log('\nStopped.');
  process.exit(0);
});

import rpio from 'rpio';

const GPIO_PIN = 17;
const SETTLE_MS = 30;

let stableState = null;
let settleTimer = null;

function toStateLabel(value) {
  return value === 0 ? 'PRESSED' : 'RELEASED';
}

function readState() {
  return rpio.read(GPIO_PIN);
}

function logCurrentState(prefix, value) {
  console.log(`${prefix}: ${toStateLabel(value)}`);
}

function applyStableRead(prefix) {
  const value = readState();
  if (value === stableState) {
    return;
  }

  stableState = value;
  logCurrentState(prefix, value);
}

rpio.init({ mapping: 'gpio' });
rpio.open(GPIO_PIN, rpio.INPUT, rpio.PULL_UP);

stableState = readState();
logCurrentState('Current state', stableState);

rpio.poll(
  GPIO_PIN,
  () => {
    if (settleTimer) {
      clearTimeout(settleTimer);
    }

    settleTimer = setTimeout(() => {
      settleTimer = null;
      applyStableRead('State changed');
    }, SETTLE_MS);
  },
  rpio.POLL_BOTH
);

console.log('Watching button state...');

process.on('SIGINT', () => {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }

  rpio.poll(GPIO_PIN, null);
  rpio.close(GPIO_PIN);
  process.exit(0);
});

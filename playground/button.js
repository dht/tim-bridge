import rpio from 'rpio';

const GPIO_PIN = 17;
const DEBOUNCE_MS = 10;
let lastEventAt = 0;

function toStateLabel(value) {
  return value === 0 ? 'PRESSED' : 'RELEASED';
}

function logCurrentState(prefix) {
  const value = rpio.read(GPIO_PIN);
  console.log(`${prefix}: ${toStateLabel(value)}`);
}

rpio.init({ mapping: 'gpio' });
rpio.open(GPIO_PIN, rpio.INPUT, rpio.PULL_UP);

logCurrentState('Current state');

rpio.poll(
  GPIO_PIN,
  () => {
    const now = Date.now();
    if (now - lastEventAt < DEBOUNCE_MS) {
      return;
    }
    lastEventAt = now;

    logCurrentState('State changed');
  },
  rpio.POLL_BOTH
);

console.log('Watching button state...');

process.on('SIGINT', () => {
  rpio.poll(GPIO_PIN, null);
  rpio.close(GPIO_PIN);
  process.exit(0);
});

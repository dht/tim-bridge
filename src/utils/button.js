import rpio from 'rpio';

const GPIO_PIN = 17;
const DEBOUNCE_MS = 10;

function toStateLabel(value) {
  return value === 0 ? 'PRESSED' : 'RELEASED';
}

export function listenToButton(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('listenToButton requires a callback function');
  }

  let lastEventAt = 0;

  rpio.init({ mapping: 'gpio' });
  rpio.open(GPIO_PIN, rpio.INPUT, rpio.PULL_UP);

  const emitState = (source) => {
    const value = rpio.read(GPIO_PIN);

    callback({
      source,
      pin: GPIO_PIN,
      value,
      label: toStateLabel(value),
      timestamp: Date.now(),
    });
  };

  emitState('initial');

  rpio.poll(
    GPIO_PIN,
    () => {
      const now = Date.now();
      if (now - lastEventAt < DEBOUNCE_MS) {
        return;
      }
      lastEventAt = now;

      emitState('change');
    },
    rpio.POLL_BOTH
  );

  return () => {
    rpio.poll(GPIO_PIN, null);
    rpio.close(GPIO_PIN);
  };
}

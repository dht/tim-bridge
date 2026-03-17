import rpio from 'rpio';

const TRIG_PIN = 23;
const ECHO_PIN = 24;
const MEASUREMENT_INTERVAL_MS = 500;
const ECHO_TIMEOUT_US = 30000;

function nowMicroseconds() {
  return Number(process.hrtime.bigint() / 1000n);
}

function waitForPinValue(pin, expectedValue, timeoutUs) {
  const deadline = nowMicroseconds() + timeoutUs;

  while (nowMicroseconds() < deadline) {
    if (rpio.read(pin) === expectedValue) {
      return true;
    }
  }

  return false;
}

function measureDistanceCm() {
  rpio.write(TRIG_PIN, rpio.LOW);
  rpio.usleep(2);

  rpio.write(TRIG_PIN, rpio.HIGH);
  rpio.usleep(10);
  rpio.write(TRIG_PIN, rpio.LOW);

  if (!waitForPinValue(ECHO_PIN, rpio.HIGH, ECHO_TIMEOUT_US)) {
    return null;
  }

  const pulseStartUs = nowMicroseconds();

  if (!waitForPinValue(ECHO_PIN, rpio.LOW, ECHO_TIMEOUT_US)) {
    return null;
  }

  const pulseEndUs = nowMicroseconds();
  const pulseWidthUs = pulseEndUs - pulseStartUs;

  return pulseWidthUs / 58;
}

function main() {
  rpio.init({ mapping: 'gpio' });

  rpio.open(TRIG_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.open(ECHO_PIN, rpio.INPUT);

  console.log(`Proximity loop started with rpio (TRIG=${TRIG_PIN}, ECHO=${ECHO_PIN})`);

  const interval = setInterval(() => {
    const distanceCm = measureDistanceCm();

    if (distanceCm == null) {
      console.log('Distance: timeout');
      return;
    }

    console.log(`Distance: ${distanceCm.toFixed(2)} cm`);
  }, MEASUREMENT_INTERVAL_MS);

  process.on('SIGINT', () => {
    clearInterval(interval);
    rpio.write(TRIG_PIN, rpio.LOW);
    rpio.close(TRIG_PIN);
    rpio.close(ECHO_PIN);
    process.exit(0);
  });
}

main();

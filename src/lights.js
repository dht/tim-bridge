import rpio from 'rpio';

export function turnLightsOn() {
  rpio.open(12, rpio.OUTPUT, rpio.LOW);
  rpio.write(12, rpio.HIGH);
}

export function turnLightsOff() {
  rpio.open(12, rpio.OUTPUT, rpio.LOW);
  rpio.write(12, rpio.LOW);
}

export function spinMotor() {
  rpio.open(16, rpio.OUTPUT, rpio.LOW);
  rpio.write(16, rpio.HIGH);
}

export function stopMotor() {
  rpio.open(16, rpio.OUTPUT, rpio.LOW);
  rpio.write(16, rpio.LOW);
}

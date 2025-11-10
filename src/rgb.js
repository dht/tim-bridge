import rpio from 'rpio';
rpio.init({ mapping: 'gpio' });

const RED = 17, GREEN = 22, BLUE = 24;

export function setColor(r, g, b) {
  rpio.open(RED, rpio.OUTPUT, rpio.LOW);
  rpio.open(GREEN, rpio.OUTPUT, rpio.LOW);
  rpio.open(BLUE, rpio.OUTPUT, rpio.LOW);

  rpio.write(RED, r ? rpio.LOW : rpio.HIGH);
  rpio.write(GREEN, g ? rpio.LOW : rpio.HIGH);
  rpio.write(BLUE, b ? rpio.LOW : rpio.HIGH);
}

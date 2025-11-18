import rpio from 'rpio';

rpio.init({ gpiomem: false });   // default mapping = physical

const RED   = 32;   // what you THINK is red
const GREEN = 33;   // what you THINK is green
const BLUE  = 12;   // what you THINK is blue

const pins = { RED, GREEN, BLUE };

for (const [name, pin] of Object.entries(pins)) {
  console.log("Testing", name, "on pin", pin);
  rpio.open(pin, rpio.OUTPUT, rpio.HIGH);
  rpio.write(pin, rpio.LOW);   // turn ON (common anode)
  await new Promise(r => setTimeout(r, 2000));
  rpio.write(pin, rpio.HIGH);  // turn OFF
}

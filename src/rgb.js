import rpio from "rpio";

rpio.init({ mapping: "gpio" });

const RED = 12,
  GREEN = 13,
  BLUE = 18;

function setupPWM(pin) {
  rpio.open(pin, rpio.PWM);
  rpio.pwmSetClockDivider(64); // reasonable resolution
  rpio.pwmSetRange(pin, 255); // 0–255 brightness
}

setupPWM(RED);
setupPWM(GREEN);
setupPWM(BLUE);

export function setColor(r, g, b) {
  rpio.pwmSetData(RED, r); // 0–255
  rpio.pwmSetData(GREEN, g);
  rpio.pwmSetData(BLUE, b);
}

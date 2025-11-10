import rpio from "rpio";

rpio.init({
  mapping: "gpio",
  gpiomem: false, // <— required for PWM
});

const RED = 11,
  GREEN = 15,
  BLUE = 18; // hardware-PWM-capable pins

function setupPWM(pin) {
  rpio.open(pin, rpio.PWM);
  rpio.pwmSetClockDivider(64);
  rpio.pwmSetRange(pin, 255); // 0–255 brightness
}

setupPWM(RED);
setupPWM(GREEN);
setupPWM(BLUE);

export function setColor(r, g, b) {
  rpio.pwmSetData(RED, r);
  rpio.pwmSetData(GREEN, g);
  rpio.pwmSetData(BLUE, b);
}

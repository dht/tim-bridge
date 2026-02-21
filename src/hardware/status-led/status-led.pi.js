// status-led.pi.js — placeholder for GPIO status LED

export function setStatusLed(state) {
  // TODO: implement GPIO status LED on Pi
  void state;
}

export const applyHardware = (fieldId, value, meta) => {
  switch (fieldId) {
    case 'statusLed':
      setStatusLed(value);
      break;
    default:
      break;
  }
};

// status-led.mac.js - stubbed on macOS

export function setStatusLed(state) {
  console.log(`[status-led][mac] setStatusLed state=${state}`);
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

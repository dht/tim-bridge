// lights.mac.js - stubbed on macOS

export async function turnLed(pin, isOn) {
  console.log(`[lights][mac] turnLed pin=${pin} on=${isOn}`);
}

export async function turnLights(lightStatus) {
  console.log(`[lights][mac] turnLights status=${lightStatus}`);
}

export const applyHardware = (fieldId, value, meta) => {
  switch (fieldId) {
    case 'lightStatus':
      turnLights(value);
      break;
    default:
      break;
  }
};

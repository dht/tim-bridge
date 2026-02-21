import * as pi from './lights.pi.js';
import * as mac from './lights.mac.js';

const impl = process.platform === 'darwin' ? mac : pi;

export const applyHardware = impl.applyHardware;
export const turnLights = impl.turnLights;
export const turnLed = impl.turnLed;

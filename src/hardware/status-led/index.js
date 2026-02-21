import * as pi from './status-led.pi.js';
import * as mac from './status-led.mac.js';

const impl = process.platform === 'darwin' ? mac : pi;

export const applyHardware = impl.applyHardware;
export const setStatusLed = impl.setStatusLed;

import { createAudioController as createPiAudio } from './audio.pi.js';
import { createAudioController as createMacAudio } from './audio.mac.js';

const createController = process.platform === 'darwin' ? createMacAudio : createPiAudio;
const { applyHardware, playMp3, stopAudio } = createController();

export { applyHardware, playMp3, stopAudio };

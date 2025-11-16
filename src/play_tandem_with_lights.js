// src/index.js
import { turnLightsOn, turnLightsOff } from './lights.js';
import { delay } from './utils.js';
import player from 'play-sound';

// speaker sequence
const LED1 = 11; // H-speaker
const LED2 = 13; // S-speaker

// paths to audio files
const sequence = [
  { led: LED1, file: 'io/H1.mp3' },
  { led: LED2, file: 'io/S1.mp3' },
  { led: LED1, file: 'io/H2.mp3' },
  { led: LED2, file: 'io/S2.mp3' },
  { led: LED1, file: 'io/H3.mp3' },
  { led: LED2, file: 'io/S3.mp3' },
];

const play = player({ player: 'mpg123' }); // force mpg123 backend

async function playFile(path) {
  return new Promise((resolve, reject) => {
    const audio = play.play(path, (err) => (err ? reject(err) : resolve()));
    audio.on('exit', resolve);
  });
}

async function main() {
  console.log('🎬 Starting LED + Audio sequence...');

  for (const { led, file } of sequence) {
    console.log(`💡 Lighting LED on pin ${led} and playing ${file}...`);
    turnLightsOn(led);
    await playFile(file);
    turnLightsOff(led);
    await delay(500); // short gap between clips
  }

  console.log('✅ Sequence complete.');
}

main().catch(console.error);

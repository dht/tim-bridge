import fs from 'node:fs';
import path from 'node:path';
import { playMp3, stopAudio } from '../src/hardware/audio.js';

const MP3_PATH = path.resolve('playground/gossip/lines-1A.mp3');
const AUTO_STOP_SECONDS = 10;

async function main() {
  if (!fs.existsSync(MP3_PATH)) {
    console.error(`MP3 not found: ${MP3_PATH}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Platform: ${process.platform}`);
  console.log(`Playing: ${MP3_PATH}`);

  await playMp3(MP3_PATH);

  console.log(`Auto stop in ${AUTO_STOP_SECONDS}s`);
  setTimeout(() => {
    console.log('Stopping audio...');
    stopAudio();
    process.exit(0);
  }, AUTO_STOP_SECONDS * 1000);
}

process.on('SIGINT', () => {
  console.log('\nSIGINT received, stopping audio...');
  stopAudio();
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  stopAudio();
  process.exit(1);
});

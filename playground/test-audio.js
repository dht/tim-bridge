import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const MP3_PATH = path.resolve('./test-audio.mp3');

const PI_UID = 1000;
const PI_GID = 1000;

function getPlayerCmd() {
  const platform = process.platform;
  if (platform === 'darwin') return { cmd: 'afplay', args: [] };
  if (platform === 'linux') return { cmd: 'mpg123', args: ['-q', '-o', 'alsa'] };
  throw new Error();
}

let player = null;
let shouldStop = false;

function stop() {
  shouldStop = true;
  if (player && !player.killed) {
    try {
      player.kill('SIGTERM');
    } catch {}
  }
}

function playOnce(filePath) {
  const absPath = path.resolve(filePath);

  const { cmd, args } = getPlayerCmd();

  const spawnOptions = {
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  };

  if (process.platform === 'linux') {
    spawnOptions.uid = PI_UID;
    spawnOptions.gid = PI_GID;
    spawnOptions.env = {
      ...spawnOptions.env,
      HOME: '/home/admin',
      USER: 'admin',
    };
  }

  return new Promise((resolve, reject) => {
    player = spawn(cmd, [...args, absPath], spawnOptions);

    player.on('exit', () => {
      player = null;
      resolve();
    });

    player.on('error', (err) => {
      player = null;
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(MP3_PATH)) {
    console.error();
    process.exitCode = 1;
    return;
  }

  console.log();
  console.log();
  console.log('Press Ctrl+C to stop.');

  while (!shouldStop) {
    try {
      await playOnce(MP3_PATH);
    } catch (err) {
      if (shouldStop) break;
      console.error(err);
      process.exitCode = 1;
      break;
    }
  }
}

process.on('SIGINT', () => {
  console.log('\nSIGINT received, stopping audio...');
  stop();
});

process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, stopping audio...');
  stop();
});

main().catch((err) => {
  console.error(err);
  stop();
  process.exit(1);
});

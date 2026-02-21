import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PI_UID = 1000;
const PI_GID = 1000;

export function createAudioController() {
  let player = null;

  const applyHardware = (fieldId, value, meta) => {
    switch (fieldId) {
      case 'mp3LocalPath':
        playMp3(value);
        break;
      default:
        break;
    }
  };

  function getPlayerCmd() {
    return { cmd: 'mpg123', args: ['-q', '-o', 'alsa'] };
  }

  async function playMp3(filePath) {
    if (player && !player.killed) {
      try {
        player.kill('SIGTERM');
      } catch {}
    }

    const absPath = path.resolve(filePath);

    if (!fs.existsSync(absPath)) {
      return;
    }

    const { cmd, args } = getPlayerCmd();

    const spawnOptions = {
      stdio: 'inherit',
      uid: PI_UID,
      gid: PI_GID,
      env: {
        ...process.env,
        HOME: '/home/admin',
        USER: 'admin',
      },
    };

    player = spawn(cmd, [...args, absPath], spawnOptions);

    player.on('exit', () => {
      player = null;
    });

    player.on('error', () => {
      player = null;
    });
  }

  function stopAudio() {
    if (player && !player.killed) {
      try {
        player.kill('SIGTERM');
      } catch {}
    }
    player = null;
  }

  return { applyHardware, playMp3, stopAudio };
}

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PI_UID = 1000;
const PI_GID = 1000;

let player = null;

// Pick command per platform
function getPlayerCmd() {
  const platform = process.platform;
  if (platform === "darwin") return { cmd: "afplay", args: [] };
  if (platform === "linux")
    return { cmd: "mpg123", args: ["-q", "-o", "alsa"] };
  throw new Error(`Unsupported platform: ${platform}`);
}

export async function playMp3(filePath) {
  // Stop any previous playback
  if (player && !player.killed) {
    try {
      player.kill("SIGTERM");
    } catch {}
  }

  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    console.warn(`[audio] file not found, skipping: ${absPath}`);
    return;
  }

  const { cmd, args } = getPlayerCmd();
  console.log(`[audio] playing local file: ${absPath} using ${cmd}`);

  const spawnOptions = {
    stdio: "inherit",
    env: {
      ...process.env,
    },
  };

  if (process.platform === "linux") {
    spawnOptions.uid = PI_UID;
    spawnOptions.gid = PI_GID;
    spawnOptions.env = {
      ...spawnOptions.env,
      HOME: "/home/admin",
      USER: "admin",
    };
  }

  player = spawn(cmd, [...args, absPath], spawnOptions);

  player.on("exit", (code, signal) => {
    console.log(`[audio] ended (code=${code}, signal=${signal})`);
    player = null;
  });

  player.on("error", (err) => {
    console.error(`[audio] failed to start ${cmd}:`, err);
    player = null;
  });
}

export function stopAudio() {
  if (player && !player.killed) {
    try {
      player.kill("SIGTERM");
    } catch {}
  }
  player = null;
}

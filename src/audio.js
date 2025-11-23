import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";

const PI_UID = 1000;
const PI_GID = 1000;

let player = null;

// Pick command per platform
function getPlayerCmd() {
  const platform = process.platform;
  if (platform === "darwin") return { cmd: "afplay", args: [] }; // macOS
  if (platform === "linux")
    return { cmd: "mpg123", args: ["-q", "-o", "alsa"] }; // Raspberry Pi/Linux
  throw new Error(`Unsupported platform: ${platform}`);
}

// Download a file to a temporary path
function downloadToTempFile(url) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(tmpdir(), `${randomUUID()}.mp3`);
    const file = fs.createWriteStream(tempFile);
    const client = url.startsWith("https") ? https : http;

    console.log(`[audio] downloading: ${url}`);
    const request = client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        response.resume(); // drain
        return;
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve(tempFile));
      });
    });

    request.on("error", (err) => {
      fs.unlink(tempFile, () => reject(err));
    });
  });
}

export async function playMp3(url) {
  // Stop any previous playback
  if (player && !player.killed) {
    try {
      player.kill("SIGTERM");
    } catch {}
  }

  try {
    const tempFile = await downloadToTempFile(url);
    const { cmd, args } = getPlayerCmd();

    console.log(`[audio] playing temp file: ${tempFile} using ${cmd}`);

    player = spawn(cmd, [...args, tempFile], {
      stdio: "inherit",
      uid: PI_UID,
      gid: PI_GID,
      env: {
        ...process.env,
        HOME: "/home/admin",
        USER: "admin",
      },
    });

    player.on("exit", (code, signal) => {
      console.log(`[audio] ended (code=${code}, signal=${signal})`);
      player = null;
      // optional: clean up temp file
      fs.unlink(tempFile, () => {});
    });

    player.on("error", (err) => {
      console.error(`[audio] failed to start ${cmd}:`, err);
      player = null;
      fs.unlink(tempFile, () => {});
    });
  } catch (err) {
    console.error(`[audio] failed to download or play:`, err);
  }
}

export function stopAudio() {
  if (player && !player.killed) {
    try {
      player.kill("SIGTERM");
    } catch {}
  }
  player = null;
}

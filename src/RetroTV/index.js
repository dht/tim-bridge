import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function defaultGuiEnv(env) {
  if (process.platform !== "linux") return env;

  const nextEnv = { ...env };

  const hasWayland = Boolean(nextEnv.WAYLAND_DISPLAY);
  const hasX11 = Boolean(nextEnv.DISPLAY);

  if (!hasWayland && !hasX11) nextEnv.DISPLAY = ":0";

  const home = nextEnv.HOME;
  if (nextEnv.DISPLAY && !nextEnv.XAUTHORITY && home) {
    const xauthority = `${home}/.Xauthority`;
    if (fs.existsSync(xauthority)) nextEnv.XAUTHORITY = xauthority;
  }

  if (!nextEnv.DBUS_SESSION_BUS_ADDRESS && typeof process.getuid === "function") {
    const uid = process.getuid();
    const busPath = `/run/user/${uid}/bus`;
    if (fs.existsSync(busPath)) {
      nextEnv.DBUS_SESSION_BUS_ADDRESS = `unix:path=${busPath}`;
    }
  }

  return nextEnv;
}

function spawnProcess(cmd, args, { env, detached = true, stdio = "ignore" } = {}) {
  const child = spawn(cmd, args, {
    stdio,
    detached,
    env: defaultGuiEnv(env || process.env),
  });
  if (detached) child.unref();
  return child;
}

function createPhotoViewerDataUrl(photoUrl, { fit = "contain", background = "#000" } = {}) {
  const safeFit = fit === "cover" ? "cover" : "contain";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RetroTV</title>
    <style>
      html, body { width: 100%; height: 100%; margin: 0; background: ${background}; overflow: hidden; }
      img { width: 100vw; height: 100vh; object-fit: ${safeFit}; display: block; }
    </style>
  </head>
  <body>
    <img src="${photoUrl}" alt="RetroTV" />
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function browserBinaries() {
  const preferred = process.env.RETROTV_BROWSER_BIN?.trim();
  return [
    preferred,
    "chromium",
    "chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
}

function launchWithFallback(bins, args, { env, dryRun, detached, stdio } = {}) {
  if (!bins.length) {
    throw new Error("No Chromium binary candidates found.");
  }

  if (dryRun) {
    const [primary, ...fallbacks] = bins;
    return { cmd: primary, args, fallbackCmds: fallbacks };
  }

  const [primary, ...fallbacks] = bins;

  const tryLaunchAtIndex = (index) => {
    const cmd = bins[index];
    const child = spawnProcess(cmd, args, { env, detached, stdio });
    child.on("error", (err) => {
      if (err?.code === "ENOENT" && index < bins.length - 1) {
        const next = bins[index + 1];
        console.warn(`Chromium binary not found: ${cmd}. Trying: ${next}`);
        tryLaunchAtIndex(index + 1);
        return;
      }
      console.error("Failed to launch Chromium:", err);
    });
    return cmd;
  };

  const cmd = tryLaunchAtIndex(0);
  return { cmd, args, fallbackCmds: fallbacks };
}

function defaultUserDataDir() {
  // Avoid "profile in use" locks when Chromium is already running (or lock file is stale).
  // Using /tmp also avoids permissions issues with system-managed homes / read-only configs.
  return path.join(os.tmpdir(), "retrotv-chromium-profile");
}

function defaultDiskCacheDir() {
  return path.join(os.tmpdir(), "retrotv-chromium-cache");
}

function buildChromiumArgs(
  url,
  {
    kiosk = true,
    app = false,
    extraArgs = [],
    userDataDir = defaultUserDataDir(),
    diskCacheDir = defaultDiskCacheDir(),
  } = {},
) {
  const args = [
    "--noerrdialogs",
    "--disable-infobars",
    "--disable-session-crashed-bubble",
    "--no-first-run",
    "--password-store=basic",
    "--disable-features=TranslateUI",
    `--user-data-dir=${userDataDir}`,
    `--disk-cache-dir=${diskCacheDir}`,
  ];

  if (kiosk) args.push("--kiosk");
  if (kiosk) args.push("--start-fullscreen");

  if (app) args.push(`--app=${url}`);
  else args.push(url);

  if (Array.isArray(extraArgs) && extraArgs.length) args.push(...extraArgs);
  return args;
}

export function openRetroTvUrl(
  url,
  {
    kiosk = true,
    app = false,
    extraArgs = [],
    userDataDir,
    diskCacheDir,
    env,
    dryRun = false,
    detached = true,
    stdio = "ignore",
  } = {},
) {
  const bins = browserBinaries();
  const args = buildChromiumArgs(url, { kiosk, app, extraArgs, userDataDir, diskCacheDir });
  return launchWithFallback(bins, args, { env, dryRun, detached, stdio });
}

export function openRetroTvPhoto(
  photoUrl,
  {
    fit = "contain",
    background = "#000",
    kiosk = true,
    app = false,
    extraArgs = [],
    userDataDir,
    diskCacheDir,
    env,
    dryRun = false,
    detached = true,
    stdio = "ignore",
  } = {},
) {
  const viewerUrl = createPhotoViewerDataUrl(photoUrl, { fit, background });
  return openRetroTvUrl(viewerUrl, {
    kiosk,
    app,
    extraArgs,
    userDataDir,
    diskCacheDir,
    env,
    dryRun,
    detached,
    stdio,
  });
}

export function closeRetroTv({ dryRun = false } = {}) {
  const killCmd = "pkill";
  const killArgs = ["-f", "chromium"];

  if (dryRun) return { cmd: killCmd, args: killArgs };

  const child = spawnProcess(killCmd, killArgs, { detached: true, stdio: "ignore" });
  child.on("error", (err) => {
    console.error("Failed to close Chromium:", err);
  });

  return { cmd: killCmd, args: killArgs };
}

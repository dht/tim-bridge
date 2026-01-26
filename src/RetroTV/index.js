import { spawn } from "node:child_process";

function defaultDisplayEnv(env) {
  if (process.platform !== "linux") return env;
  if (env.DISPLAY) return env;
  return { ...env, DISPLAY: ":0" };
}

function spawnDetached(cmd, args, { env } = {}) {
  const child = spawn(cmd, args, {
    stdio: "ignore",
    detached: true,
    env: defaultDisplayEnv(env || process.env),
  });
  child.unref();
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

function launchWithFallback(bins, args, { env, dryRun } = {}) {
  if (!bins.length) {
    throw new Error("No Chromium binary candidates found.");
  }

  const [primary, ...fallbacks] = bins;
  if (dryRun) {
    return { cmd: primary, args, fallbackCmds: fallbacks };
  }

  const child = spawnDetached(primary, args, { env });
  child.on("error", (err) => {
    if (err?.code !== "ENOENT" || fallbacks.length === 0) {
      console.error("Failed to launch Chromium:", err);
      return;
    }

    const fallback = fallbacks[0];
    console.warn(`Chromium binary not found: ${primary}. Trying: ${fallback}`);
    const fallbackChild = spawnDetached(fallback, args, { env });
    fallbackChild.on("error", (fallbackErr) => {
      console.error("Failed to launch Chromium (fallback):", fallbackErr);
    });
  });

  return { cmd: primary, args, fallbackCmds: fallbacks };
}

function buildChromiumArgs(url, { kiosk = true, app = true, extraArgs = [] } = {}) {
  const args = [
    "--noerrdialogs",
    "--disable-infobars",
    "--disable-session-crashed-bubble",
    "--no-first-run",
    "--password-store=basic",
    "--disable-features=TranslateUI",
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
  { kiosk = true, app = true, extraArgs = [], env, dryRun = false } = {},
) {
  const bins = browserBinaries();
  const args = buildChromiumArgs(url, { kiosk, app, extraArgs });
  return launchWithFallback(bins, args, { env, dryRun });
}

export function openRetroTvPhoto(
  photoUrl,
  { fit = "contain", background = "#000", kiosk = true, app = true, extraArgs = [], env, dryRun = false } = {},
) {
  const viewerUrl = createPhotoViewerDataUrl(photoUrl, { fit, background });
  return openRetroTvUrl(viewerUrl, { kiosk, app, extraArgs, env, dryRun });
}

export function closeRetroTv({ dryRun = false } = {}) {
  const killCmd = "pkill";
  const killArgs = ["-f", "chromium"];

  if (dryRun) return { cmd: killCmd, args: killArgs };

  const child = spawnDetached(killCmd, killArgs);
  child.on("error", (err) => {
    console.error("Failed to close Chromium:", err);
  });

  return { cmd: killCmd, args: killArgs };
}


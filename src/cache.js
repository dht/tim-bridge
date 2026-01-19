// timelineCache.js
import axios from "axios";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { delay } from "./delay.js";
import { updateMachineCreator } from "./firestore.js";
import { log } from "./log.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cache folder next to these modules
const CACHE_ROOT = path.join(__dirname, "../cache");

export function extractSessionId(timelineUrl) {
  // .../sessions/S483/_timeline.json?rnd=...
  const m = String(timelineUrl).match(/\/sessions\/([^/]+)\/_timeline\.json/i);
  if (!m?.[1]) {
    log.error("cache: failed to extract sessionId", { timelineUrl });
    throw new Error(`Can't extract sessionId from timelineUrl: ${timelineUrl}`);
  }
  return m[1];
}

function toSessionsRelativePath(assetUrl) {
  // https://.../sessions/_milki/line-1A.mp3 -> "line-1A.mp3"
  const cleanUrl = String(assetUrl).split("?")[0];
  const m = cleanUrl.match(/\/sessions\/[^/]+\/(.+)$/i);
  return m?.[1] ?? null;
}

async function ensureDir(p) {
  log.info("cache: ensure dir", { path: p });
  await fsp.mkdir(p, { recursive: true });
}

async function exists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort download.
 * Returns { ok: true } if the file exists or was downloaded.
 * Returns { ok: false, reason, status? } if it failed (no throw).
 */
async function downloadFileGraceful(url, destPathRaw) {
  // remove query params for filesystem path
  const destPath = destPathRaw.split("?")[0];
  await ensureDir(path.dirname(destPath));
  if (await exists(destPath)) {
    log.info("cache: asset already present", { destPath });
    return { ok: true };
  }

  // Write to a temp file then rename, so partial downloads don't masquerade as success.
  const tmpPath = destPath + ".partial";

  try {
    const res = await axios.get(url, {
      responseType: "stream",
      // Let axios resolve even on 404/500 so we can decide to fail gracefully
      validateStatus: () => true,
      timeout: 30_000,
    });

    if (res.status < 200 || res.status >= 300) {
      // Drain the stream if present to avoid dangling sockets.
      if (res.data?.destroy) res.data.destroy();
      log.warn("cache: asset download failed (http)", {
        url,
        status: res.status,
      });
      return { ok: false, reason: "http", status: res.status };
    }

    await new Promise((resolve, reject) => {
      const w = fs.createWriteStream(tmpPath);
      res.data.pipe(w);
      w.on("finish", resolve);
      w.on("error", reject);
    });

    await fsp.rename(tmpPath, destPath);
    log.info("cache: asset downloaded", { url, destPath });
    return { ok: true };
  } catch (err) {
    // Clean up partial file if it exists
    try {
      await fsp.rm(tmpPath, { force: true });
    } catch {
      // ignore
    }
    log.error("cache: asset download error", { url, destPath, err });
    return { ok: false, reason: "error", error: err };
  }
}

function collectAssetUrls(timeline) {
  const urls = new Set();
  for (const item of timeline ?? []) {
    const s = item?.state ?? {};
    if (s.mp3Url) urls.add(s.mp3Url);
    if (s.imageUrl) urls.add(s.imageUrl);
  }
  return [...urls];
}

function fixIds(timeline, { machineId, sessionId }) {
  return timeline.map((item, index) => {
    const id = [machineId, sessionId, index].join("|");

    return {
      id,
      ...item,
    };
  });
}
/**
 * Ensures timeline + assets are cached under: cache/<sessionId>/
 * Returns:
 *   { sessionId, sessionDir, timeline, resolveLocal(url)->localPath|null, assetFailures }
 */
export async function cacheSessionFromTimelineUrl(machineId, timelineUrl) {
  const updateMachine = updateMachineCreator(machineId);

  log.info("cache: start session cache", { machineId, timelineUrl });
  await updateMachine({
    bridgeStatus: "CACHING",
  });

  await delay(150);

  const sessionId = extractSessionId(timelineUrl);
  const sessionDir = path.join(CACHE_ROOT, sessionId);
  await ensureDir(sessionDir);

  // 1) timeline.json (NOT graceful; if this fails, we should fail)
  const timelinePath = path.join(sessionDir, "timeline.json");
  let timeline;

  if (await exists(timelinePath)) {
    log.info("cache: timeline cache hit", { timelinePath });
    timeline = JSON.parse(await fsp.readFile(timelinePath, "utf-8"));
  } else {
    log.info("cache: downloading timeline", { timelineUrl, timelinePath });
    const res = await axios.get(timelineUrl);
    timeline = res.data;

    timeline = fixIds(timeline, { machineId, sessionId });

    await fsp.writeFile(
      timelinePath,
      JSON.stringify(timeline, null, 2),
      "utf-8",
    );
    log.info("cache: timeline saved", { timelinePath });
  }

  // 2) assets (graceful)
  const assetFailures = [];
  const assetUrls = collectAssetUrls(timeline);
  log.info("cache: caching assets", {
    sessionId,
    assetCount: assetUrls.length,
  });

  for (const url of assetUrls) {
    const rel = toSessionsRelativePath(url);
    if (!rel) {
      log.warn("cache: asset url not under /sessions/, skipping", { url });
      continue;
    }

    const dest = path.join(sessionDir, rel);
    const result = await downloadFileGraceful(url, dest);

    if (!result.ok) {
      assetFailures.push({
        url,
        dest,
        ...("status" in result ? { status: result.status } : {}),
        reason: result.reason,
      });
      // continue. because life is pain and your code should reflect that.
    }
  }

  function resolveLocal(url) {
    const rel = toSessionsRelativePath(url);
    if (!rel) return null;
    return path.join(sessionDir, rel);
  }

  log.info("cache: session cache complete", {
    sessionId,
    sessionDir,
    assetsFailed: assetFailures.length,
  });

  return {
    sessionId,
    sessionDir,
    isPreset: sessionId.startsWith("_"),
    timeline,
    resolveLocal,
    assetFailures,
  };
}

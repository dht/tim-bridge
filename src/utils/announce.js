import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { delay } from './timeline.utils.js';

const ANNOUNCEMENTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/announcements'
);
const AUDIO_MODULE_URL = pathToFileURL(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hardware/audio.js')
).href;
const DEFAULT_ANNOUNCE_DURATION_MS = 40 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getAudioChannel = (channelId) => import(`${AUDIO_MODULE_URL}?channel=${channelId}`);

function resolveAnnouncementPath(sessionId) {
  const raw = String(sessionId ?? '').trim();
  const normalized = raw.replace(/^announce\./, '').replace(/\.mp3$/, '');

  if (!normalized) {
    return null;
  }

  const candidates = new Set([`announce.${normalized}.mp3`]);

  if (normalized.startsWith('_')) {
    candidates.add(`announce.${normalized.slice(1)}.mp3`);
  } else {
    candidates.add(`announce._${normalized}.mp3`);
  }

  for (const fileName of candidates) {
    const candidatePath = path.join(ANNOUNCEMENTS_DIR, fileName);

    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

export async function announce(sessionId, options = {}) {
  const durationMs = Number(options.durationMs ?? DEFAULT_ANNOUNCE_DURATION_MS);
  const waitMs =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : DEFAULT_ANNOUNCE_DURATION_MS;

  const backgroundPath = path.join(ANNOUNCEMENTS_DIR, 'bk.out.mp3');
  const sessionPath = resolveAnnouncementPath(sessionId);

  const [bgAudio, voiceAudio] = await Promise.all([
    getAudioChannel('announce-bg'),
    getAudioChannel('announce-voice'),
  ]);

  bgAudio.stopAudio();
  voiceAudio.stopAudio();

  if (fs.existsSync(backgroundPath)) {
    await bgAudio.playMp3(backgroundPath);
  } else {
    console.warn(`[announce] Missing background track: ${backgroundPath}`);
  }

  if (sessionPath) {
    await delay(2 * 1000);
    await voiceAudio.playMp3(sessionPath);
  } else {
    console.warn(`[announce] Missing session track for "${sessionId}" in ${ANNOUNCEMENTS_DIR}`);
  }

  await sleep(waitMs);

  bgAudio.stopAudio();
  voiceAudio.stopAudio();
}

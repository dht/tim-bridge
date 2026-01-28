import fs from 'fs-extra';
import { getShouldStop } from './globals.js';

export function getTimeline(localFolder) {
  const filePathTimeline = `${localFolder}/_timeline.json`;
  const timelineJson = fs.readJsonSync(filePathTimeline);

  return timelineJson;
}

const fixUrl = (machineId, url) => {
  if (!url) return url;

  const parts = url.split('/');
  const fileName = parts.pop();
  const sessionId = parts.pop();

  return `./cache/${machineId}/${sessionId}/${fileName}`;
};

export const changeRemoteUrlsToLocalPath = (machineId, timelineJson) => {
  return timelineJson.map((item) => {
    const { state } = item;
    let { mp3Url, imageUrl } = state || {};

    if (mp3Url) {
      state.mp3LocalPath = fixUrl(machineId, mp3Url);
    }

    if (imageUrl) {
      state.imageLocalPath = fixUrl(machineId, imageUrl);
    }

    return {
      ...item,
      state,
    };
  });
};

export const extractTimelineAssets = (timelineJson) => {
  const assets = [];

  timelineJson.forEach((item) => {
    const { state } = item;
    const { mp3Url, imageUrl } = state || {};

    if (mp3Url) {
      assets.push(mp3Url);
    }
    if (imageUrl) {
      assets.push(imageUrl);
    }
  });

  return assets;
};

export const getTimelineDuration = (timelineJson) => {
  if (timelineJson.length === 0) return 0;

  const lastItem = timelineJson[timelineJson.length - 1];
  return lastItem.ts;
};

export const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// currentTs and keyframe ts are in seconds, so keep the window in seconds too
const MAX_DELTA_S = 0.2;

export const getRelevantKeyframes = (timelineJson, currentTs, playedIndex) => {
  return timelineJson.filter((item) => {
    const { index, ts } = item;

    if (playedIndex[index]) {
      return false;
    }

    const delta = Math.abs(currentTs - ts);

    if (delta > MAX_DELTA_S) {
      return false;
    }

    return true;
  });
};

export const stopIfNeeded = (machineId, timelineType) => {
  const shouldStop = getShouldStop(machineId, timelineType);

  if (shouldStop) {
    stopAllHardware(machineId);
    console.log('Stopping timeline playback for machine:', machineId);
  }

  return shouldStop;
};

import fs from 'fs-extra';

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
  return timelineJson.map(item => {
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

export const extractTimelineAssets = timelineJson => {
  const assets = [];

  timelineJson.forEach(item => {
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

import fs from 'fs-extra';
import { getJson } from './axios.js';
import { setBridgeStatus } from './status.js';
import { downloadAssetsFromUrls } from './storage.js';
import { changeRemoteUrlsToLocalPath, extractTimelineAssets, fixIds } from './timeline.utils.js';

const STORAGE_BASE_URL = process.env.STORAGE_BASE_URL;
const ERASE_FOR_DEV = true;

export const cacheOrder = async (order) => {
  const { machineId, sessionId } = order;

  try {
    // if cache exists return true

    // otherwise download both timeline and assets to a dedicated folder for the specific machineId+sessionId

    const localFolder = `./cache/${machineId}/${sessionId}`;

    if (fs.existsSync(localFolder)) {
      if (ERASE_FOR_DEV) {
        fs.removeSync(localFolder);
      } else {
        return true;
      }
    }

    fs.ensureDirSync(localFolder);

    setBridgeStatus(machineId, 'CACHING');

    // downloaded the main _timeline.json file
    const url = getTimelineUrl(machineId, sessionId);

    console.log('timeline URL', url);

    let timelineJson = await getJson(url);

    const assets = extractTimelineAssets(timelineJson);

    timelineJson = changeRemoteUrlsToLocalPath(timelineJson, { machineId });
    timelineJson = fixIds(timelineJson, { machineId, sessionId });

    const filePathTimeline = `${localFolder}/_timeline.json`;
    fs.writeJsonSync(filePathTimeline, timelineJson, { spaces: 2 });

    await downloadAssetsFromUrls(assets, localFolder);
    // download all assets
  } catch (err) {
    console.log('err =>', err);
    setBridgeStatus(machineId, 'IDLE');
  }
};

export const getTimelineUrl = (machineId, sessionId) => {
  return `${STORAGE_BASE_URL}/${machineId}/sessions/${sessionId}/_timeline.json?t=13`;
};

import fs from 'fs-extra';
import { getJson } from './axios.js';
import { downloadAssetsFromUrls } from './storage.js';
import { changeRemoteUrlsToLocalPath, extractTimelineAssets } from './timeline.utils.js';

const STORAGE_BASE_URL = process.env.STORAGE_BASE_URL;
const ERASE_FOR_DEV = true;

export const cacheOrder = async order => {
  const { machineId, sessionId } = order;

  // if cache exists return true

  // otherwise download both timeline and assets to a dedicated folder for the specific machineId+sessionId

  const localFolder = `./cache/${machineId}/${sessionId}`;

  if (fs.existsSync(localFolder)) {
    if (ERASE_FOR_DEV) {
      fs.removeSync(localFolder);
    } else {
      console.log('Cache exists for', machineId, sessionId);
      return true;
    }
  }

  fs.ensureDirSync(localFolder);

  // downloaded the main _timeline.json file
  const url = `${STORAGE_BASE_URL}/sessions/${sessionId}/_timeline.json`;
  let timelineJson = await getJson(url);
  const assets = extractTimelineAssets(timelineJson);

  timelineJson = changeRemoteUrlsToLocalPath(machineId, timelineJson);

  const filePathTimeline = `${localFolder}/_timeline.json`;
  fs.writeJsonSync(filePathTimeline, timelineJson, { spaces: 2 });

  console.log(assets);

  await downloadAssetsFromUrls(assets, localFolder);
  // download all assets
};

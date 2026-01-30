import { stopAllHardware } from '../hardware/index.js';
import { onPlaybackEnded } from '../lifecycle/_generic.js';
import { cacheOrder, getTimelineUrl } from './cache.js';
import { syncKeyframes } from './keyframes.js';
import { addRun } from './runs.js';
import { setBridgeStatus } from './status.js';
import { playTimelineCore } from './timeline.core.js';
import { delay, getTimeline } from './timeline.utils.js';

export const playOrder = async (order) => {
  try {
    const { machineId, sessionId, originWebpageUrl } = order;
    const localFolder = `./cache/${machineId}/${sessionId}`;

    await cacheOrder(order);

    const timelineJson = getTimeline(localFolder);

    setBridgeStatus(machineId, 'PLAYBACK');
    playTimelineCore(machineId, timelineJson);

    const timelineUrl = getTimelineUrl(machineId, sessionId);

    const isDev = machineId.endsWith('-dev');

    await syncKeyframes(timelineJson, { machineId, sessionId });

    await addRun(machineId, sessionId, timelineJson, timelineUrl, {
      originWebpageUrl,
      isDev,
    });
  } catch (err) {
    console.log('err =>', err);
  }
};

export const stopOrder = async (order) => {
  try {
    const { machineId } = order;
    setBridgeStatus(machineId, 'RESETTING');

    stopAllHardware(machineId);

    await delay(100);

    await onPlaybackEnded(machineId);
  } catch (err) {
    console.log('err =>', err);
  }
};

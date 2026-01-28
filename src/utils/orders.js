import { cacheOrder } from './cache.js';
import { playTimeline } from './timeline.core.js';
import { getTimeline } from './timeline.utils.js';

export const playOrder = async order => {
  const { machineId, sessionId } = order;
  const localFolder = `./cache/${machineId}/${sessionId}`;

  await cacheOrder(order);

  const timelineJson = getTimeline(localFolder);

  playTimeline(timelineJson);
};

export const stopOrder = async order => {};

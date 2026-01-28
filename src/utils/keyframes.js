import { delay } from './timeline.utils.js';

export function applyKeyframe(machineId, keyframeJson) {
  console.log('Applying keyframe for machine:', machineId, keyframeJson);
}

export async function applyKeyframes(machineId, keyframes, playedIndex) {
  if (keyframes.length === 0) {
    return;
  }

  for (const item of keyframes) {
    const { index } = item;
    await delay(10);
    applyKeyframe(machineId, item);
    playedIndex[index] = true;
  }
}

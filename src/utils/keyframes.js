import { applyHardware } from '../hardware/index.js';
import { updateMachineCreator } from './firestore.js';
import { delay } from './timeline.utils.js';

export async function applyKeyframe(machineId, keyframeJson, meta) {
  const { timelineType } = meta;
  const updateMachine = updateMachineCreator(machineId);

  const { index, state } = keyframeJson;

  console.log(`[${machineId}] Applying keyframe #${index} for timelineType: ${timelineType}`);

  for (const fieldId in state) {
    const value = state[fieldId];
    applyHardware(fieldId, value, { machineId });
  }

  if (timelineType === 'IDLE') {
    return;
  }

  updateMachine({
    ...state,
  });
}

export async function applyKeyframes(machineId, keyframes, playedIndex, meta) {
  if (keyframes.length === 0) {
    return;
  }

  for (const item of keyframes) {
    const { index } = item;
    await delay(10);
    applyKeyframe(machineId, item, meta);
    playedIndex[index] = true;
  }
}

import { applyHardware } from '../hardware/index.js';
import { updateMachineCreator } from './firestore.js';
import { delay } from './timeline.utils.js';

export async function applyKeyframe(machineId, keyframeJson, meta) {
  const { timelineType } = meta;
  console.log('Applying keyframe for machine:', machineId, keyframeJson);
  const updateMachine = updateMachineCreator(machineId);

  const { state } = keyframeJson;

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

  console.log('Applying', keyframes.length, 'keyframes for machine:', machineId);

  for (const item of keyframes) {
    const { index } = item;
    await delay(10);
    applyKeyframe(machineId, item, meta);
    playedIndex[index] = true;
  }
}

import { updateMachineCreator, updateRunCreator } from './firestore.js';
import { guid4 } from './guid.js';
import { calcTimelineDuration } from './timeline.utils.js';

export async function addRun(machineId, sessionId, timeline, timelineUrl, runExtra = {}) {
  const runId = guid4();

  const updateRun = updateRunCreator(runId);
  const updateMachine = updateMachineCreator(machineId);

  const duration = await calcTimelineDuration(timeline);

  const isPreset = sessionId.startsWith('_');

  await updateRun({
    id: runId,
    isPreset,
    machineId,
    sessionId,
    startTs: Date.now(),
    duration,
    timelineUrl,
    ...runExtra,
  });

  await updateMachine({
    lastRunTs: Date.now(),
    timelineDuration: duration,
    timelineStartTime: Date.now(),
  });
}

//   syncKeyframes(timeline, { machineId, sessionId });

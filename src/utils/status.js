import { updateMachineCreator } from './firestore.js';
import { setTimelineState } from './globals.js';

// firebase + local
export const setTimelineStatus = async (machineId, value) => {
  const updateMachine = updateMachineCreator(machineId);

  setTimelineState(machineId, value);

  updateMachine({
    timelineStatus: value,
  });
};

// firebase + local
export const setBridgeStatus = async (machineId, value) => {
  const updateMachine = updateMachineCreator(machineId);

  updateMachine({
    bridgeStatus: value,
  });
};

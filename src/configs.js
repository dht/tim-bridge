import { lifecycle } from "./installations/index.js";
import { machinesInfo } from "./machines.js";
import { predicates } from "./predicates/index.js";

export function getMachineConfig(id) {
  const machineInfo = machinesInfo?.[id];
  const callbacks = lifecycle?.[id];

  if (!machineInfo) {
    log.warn(`No machinesInfo found for MACHINE_ID: ${id}`);
    return null;
  }

  if (!callbacks) {
    log.warn(`No lifecycle callbacks found for MACHINE_ID: ${id}`);
    return null;
  }

  const onStart = callbacks?.onStart;
  const onChange = callbacks?.onChange;
  const onEnd = callbacks?.onEnd;

  if (
    typeof onStart !== "function" ||
    typeof onChange !== "function" ||
    typeof onEnd !== "function"
  ) {
    log.warn(
      `Lifecycle for ${id} is missing required handlers (onStart/onChange/onEnd).`
    );
    return null;
  }

  const playbackFlavour = machineInfo.playbackFlavour || "session";
  const predicate = predicates?.[playbackFlavour];

  // Preserve existing behavior
  const collection = id === "A-003" ? "state" : "machines";

  return { id, machineInfo, callbacks, playbackFlavour, predicate, collection };
}

import { getLogger } from "./globals.js";
import { lifecycle } from "./installations/index.js";
import { machinesInfo } from "./machines.js";
import { predicates } from "./predicates/index.js";

export function getMachineConfig(id) {
  const logger = getLogger();

  const machineInfo = machinesInfo?.[id];
  const productId = machineInfo?.productId;
  const callbacks = lifecycle?.[productId];

  if (!machineInfo) {
    logger.warn(`No machinesInfo found for MACHINE_ID: ${id}`);
    return null;
  }

  if (!callbacks) {
    logger.warn(`No lifecycle callbacks found for MACHINE_ID: ${id}`);
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
    logger.warn(
      `Lifecycle for ${id} is missing required handlers (onStart/onChange/onEnd).`,
    );
    return null;
  }

  const playbackFlavour = machineInfo.playbackFlavour || "session";
  const predicate = predicates?.[playbackFlavour];

  // Preserve existing behavior
  const collection = productId === "A-003" ? "state" : "machines";

  return { id, machineInfo, callbacks, playbackFlavour, predicate, collection };
}

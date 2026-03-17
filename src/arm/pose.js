import { moveToAngle } from '../servos.js';

export const ARM_MACHINE_ID = 'A-003';

export const ARM_JOINTS = [
  { key: 'base', channel: 1 },
  { key: 'shoulder', channel: 2 },
  { key: 'elbow', channel: 3 },
  { key: 'wristPitch', channel: 4 },
  { key: 'wristRoll', channel: 5 },
  { key: 'gripperOpen', channel: 6 },
];

export function sanitizePose(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'not-an-object' };
  }

  const pose = {};

  for (const { key } of ARM_JOINTS) {
    const value = input[key];
    if (!Number.isFinite(value)) {
      return { ok: false, error: `invalid-${key}` };
    }

    pose[key] = value;
  }

  return { ok: true, pose };
}

export async function applyPose(pose, { lastPose = {} } = {}) {
  const nextLastPose = { ...lastPose };

  for (const { key, channel } of ARM_JOINTS) {
    const value = pose?.[key];
    if (!Number.isFinite(value)) {
      continue;
    }

    if (nextLastPose[key] !== value) {
      try {
        await moveToAngle(channel, value);
        nextLastPose[key] = value;
      } catch {
        // Ignore if the servo driver is not ready on this machine.
      }
    }
  }

  return nextLastPose;
}

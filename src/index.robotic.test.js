import './utils/load-env.js';
import { ARM_JOINTS, applyPose } from './arm/pose.js';
import {
  DEFAULT_POSITION_ID,
  getPositionById,
  loadRoboticConfig,
} from './arm/config.js';
import { clamp, init, shutdown, waitUntilReady } from './servos.js';

const DEFAULT_TEST_DELTA_DEG = 6;
const DEFAULT_HOLD_MS = 600;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usage() {
  return [
    'Robotic arm servo test runner',
    '',
    'Usage:',
    '  node src/index.robotic.test.js [positionId] [--delta 6] [--hold-ms 600] [--dry-run] [--shutdown]',
    '',
    `Default position id: ${DEFAULT_POSITION_ID}`,
  ].join('\n');
}

function parseArgs(argv) {
  const args = [...argv];
  const parsed = {
    positionId: DEFAULT_POSITION_ID,
    deltaDeg: DEFAULT_TEST_DELTA_DEG,
    holdMs: DEFAULT_HOLD_MS,
    dryRun: false,
    shutdownAfterTest: false,
  };

  while (args.length) {
    const arg = args.shift();

    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--shutdown') {
      parsed.shutdownAfterTest = true;
      continue;
    }

    if (arg === '--delta') {
      parsed.deltaDeg = Number(args.shift());
      continue;
    }

    if (arg === '--hold-ms') {
      parsed.holdMs = Number(args.shift());
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
      continue;
    }

    if (!arg.startsWith('-') && parsed.positionId === DEFAULT_POSITION_ID) {
      parsed.positionId = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(parsed.deltaDeg) || parsed.deltaDeg <= 0) {
    throw new Error('--delta must be a positive number.');
  }

  if (!Number.isFinite(parsed.holdMs) || parsed.holdMs < 0) {
    throw new Error('--hold-ms must be zero or greater.');
  }

  return parsed;
}

function getTestAngle(baseAngle, deltaDeg) {
  const forwardAngle = clamp(baseAngle + deltaDeg, 0, 180);
  if (forwardAngle !== baseAngle) {
    return forwardAngle;
  }

  return clamp(baseAngle - deltaDeg, 0, 180);
}

function logTestPlan(position, deltaDeg) {
  const { id, pose } = position;

  console.log(`Testing robotic arm servos from "${id}" with delta=${deltaDeg}deg...`);
  console.table(
    ARM_JOINTS.map(({ key, channel }) => ({
      joint: key,
      channel,
      baseAngle: pose[key],
      testAngle: getTestAngle(pose[key], deltaDeg),
    }))
  );
}

export async function mainRoboticTest({
  positionId = DEFAULT_POSITION_ID,
  deltaDeg = DEFAULT_TEST_DELTA_DEG,
  holdMs = DEFAULT_HOLD_MS,
  dryRun = false,
  shutdownAfterTest = false,
} = {}) {
  const config = await loadRoboticConfig();
  const position = getPositionById(config, positionId);
  const basePose = position.pose;

  logTestPlan(position, deltaDeg);

  if (dryRun) {
    console.log('Dry run enabled. No servo command was executed.');
    return;
  }

  init();
  await waitUntilReady();

  let lastPose = await applyPose(basePose);
  await delay(position.settleMs);

  for (const { key, channel } of ARM_JOINTS) {
    const testAngle = getTestAngle(basePose[key], deltaDeg);
    const testPose = {
      ...basePose,
      [key]: testAngle,
    };

    console.log(
      `Testing joint "${key}" on channel ${channel}: ${basePose[key]} -> ${testAngle} -> ${basePose[key]}`
    );

    lastPose = await applyPose(testPose, { lastPose });
    await delay(holdMs);
    lastPose = await applyPose(basePose, { lastPose });
    await delay(holdMs);
  }

  if (shutdownAfterTest) {
    shutdown();
  }

  console.log('Robotic arm servo test finished.');
}

async function runCli() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    console.log(usage());
    return;
  }

  await mainRoboticTest(parsed);
}

runCli().catch((error) => {
  console.error('Robotic arm servo test failed:', error?.message || error);
  process.exitCode = 1;
});

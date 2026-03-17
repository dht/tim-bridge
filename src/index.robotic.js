import './utils/load-env.js';
import { ARM_JOINTS, applyPose } from './arm/pose.js';
import {
  DEFAULT_POSITION_ID,
  getPositionById,
  loadRoboticConfig,
} from './arm/config.js';
import { init, shutdown, waitUntilReady } from './servos.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usage() {
  return [
    'Robotic arm position runner',
    '',
    'Usage:',
    '  node src/index.robotic.js [positionId] [--dry-run] [--shutdown]',
    '  node src/index.robotic.js --list',
    '',
    `Default position id: ${DEFAULT_POSITION_ID}`,
  ].join('\n');
}

function parseArgs(argv) {
  const args = [...argv];
  const parsed = {
    positionId: DEFAULT_POSITION_ID,
    dryRun: false,
    list: false,
    shutdownAfterMove: false,
  };

  while (args.length) {
    const arg = args.shift();

    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--list') {
      parsed.list = true;
      continue;
    }

    if (arg === '--shutdown') {
      parsed.shutdownAfterMove = true;
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

  return parsed;
}

function logPosition(position) {
  const { id, description, pose } = position;

  console.log(`Moving robotic arm to "${id}"...`);
  if (description) {
    console.log(description);
  }

  console.table(
    ARM_JOINTS.map(({ key, channel }) => ({
      joint: key,
      channel,
      angle: pose[key],
    }))
  );
}

export async function mainRobotic({
  positionId = DEFAULT_POSITION_ID,
  dryRun = false,
  shutdownAfterMove = false,
} = {}) {
  const config = await loadRoboticConfig();
  const position = getPositionById(config, positionId);

  logPosition(position);

  if (dryRun) {
    console.log('Dry run enabled. No servo command was executed.');
    return;
  }

  init();
  await waitUntilReady();
  await applyPose(position.pose);
  await delay(position.settleMs);

  if (shutdownAfterMove) {
    shutdown();
  }

  console.log(`Robotic arm move finished for "${position.id}".`);
}

async function runCli() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    console.log(usage());
    return;
  }

  const config = await loadRoboticConfig();

  if (parsed.list) {
    const ids = config.positions.map((position) => position.id);
    for (const id of ids) {
      console.log(id);
    }
    return;
  }

  await mainRobotic(parsed);
}

runCli().catch((error) => {
  console.error('Robotic arm move failed:', error?.message || error);
  process.exitCode = 1;
});

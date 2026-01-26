import process from "process";
import { init, shutdown, waitUntilReady } from "../servos.js";
import { applyPose, sanitizePose } from "./pose.js";
import {
  ensurePositionsDir,
  listPositions,
  readPosition,
  resolvePositionsDir,
} from "./positions.js";

function usage() {
  return [
    "Arm positions CLI",
    "",
    "Usage:",
    "  node src/arm/cli.js list [--machine A-003]",
    "  node src/arm/cli.js go <posName> [--machine A-003] [--shutdown] [--dry-run]",
    "  node src/arm/cli.js init [--machine A-003]",
    "",
    "Positions live in:",
    `  ${resolvePositionsDir({ machineId: "A-003" })}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = [...argv];
  const out = { _: [] };
  while (args.length) {
    const a = args.shift();
    if (a === "--machine") out.machineId = args.shift();
    else if (a === "--shutdown") out.shutdown = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else out._.push(a);
  }
  return out;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    process.exit(0);
  }

  const machineId = parsed.machineId || process.env.MACHINE_ID || "A-003";
  const cmd = parsed._[0] || "list";

  if (cmd === "init") {
    const dir = await ensurePositionsDir({ machineId });
    console.log(dir);
    return;
  }

  if (cmd === "list") {
    const names = await listPositions({ machineId });
    if (!names.length) {
      console.log("(none)");
      return;
    }
    for (const n of names) console.log(n);
    return;
  }

  const posName = cmd === "go" ? parsed._[1] : cmd;
  if (!posName) {
    console.error("Missing position name.");
    console.log(usage());
    process.exit(2);
  }

  const data = await readPosition(posName, { machineId });
  const sanitized = sanitizePose(data);
  if (!sanitized.ok) {
    console.error(`Invalid pose file for ${posName}: ${sanitized.error}`);
    process.exit(2);
  }

  if (parsed.dryRun) {
    console.log(JSON.stringify(sanitized.pose, null, 2));
    return;
  }

  init();
  await waitUntilReady();

  applyPose(sanitized.pose);

  if (parsed.shutdown) shutdown();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});


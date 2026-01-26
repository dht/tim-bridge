import fs from "fs-extra";
import path from "path";
import { ARM_MACHINE_ID } from "./pose.js";

export function resolvePositionsDir({ machineId = ARM_MACHINE_ID, rootDir = process.cwd() } = {}) {
  return path.join(rootDir, "positions", machineId);
}

export function resolvePositionPath(
  name,
  { machineId = ARM_MACHINE_ID, rootDir = process.cwd() } = {}
) {
  const safeName = String(name || "").trim();
  if (!safeName) return null;
  return path.join(resolvePositionsDir({ machineId, rootDir }), `${safeName}.json`);
}

export async function listPositions({ machineId = ARM_MACHINE_ID, rootDir = process.cwd() } = {}) {
  const dir = resolvePositionsDir({ machineId, rootDir });
  if (!(await fs.pathExists(dir))) return [];

  const items = await fs.readdir(dir);
  return items
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/i, ""))
    .sort((a, b) => a.localeCompare(b));
}

export async function readPosition(
  name,
  { machineId = ARM_MACHINE_ID, rootDir = process.cwd() } = {}
) {
  const filePath = resolvePositionPath(name, { machineId, rootDir });
  if (!filePath) {
    const err = new Error("Missing position name.");
    err.code = "missing-name";
    throw err;
  }
  if (!(await fs.pathExists(filePath))) {
    const err = new Error(`Position not found: ${name}`);
    err.code = "not-found";
    err.filePath = filePath;
    throw err;
  }
  return fs.readJson(filePath);
}

export async function ensurePositionsDir(
  { machineId = ARM_MACHINE_ID, rootDir = process.cwd() } = {}
) {
  const dir = resolvePositionsDir({ machineId, rootDir });
  await fs.ensureDir(dir);
  return dir;
}


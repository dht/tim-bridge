import fs from "fs-extra";
import path from "path";
import util from "util";

const outputPath = path.join(process.cwd());
const logPath = path.join(outputPath, "log.txt");
let crashHandlersRegistered = false;

function ensureLogFile() {
  try {
    fs.ensureFileSync(logPath);
  } catch (err) {
    console.error("Failed to ensure log file:", err);
  }
}

function writeLogLine(level, args) {
  const timestamp = new Date().toISOString();
  const message = util.format(...args);
  const logEntry = `[${timestamp}] ${level.padEnd(5)} ${message}\n`;

  try {
    ensureLogFile();
    fs.appendFileSync(logPath, logEntry, { encoding: "utf-8" });
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

export function clearLog() {
  try {
    fs.writeFileSync(logPath, "", { encoding: "utf-8" });
  } catch (err) {
    console.error("Failed to clear log file:", err);
  }
}

export const log = {
  info: (...args) => {
    console.log(...args);
    writeLogLine("INFO", args);
  },
  warn: (...args) => {
    console.warn(...args);
    writeLogLine("WARN", args);
  },
  error: (...args) => {
    console.error(...args);
    writeLogLine("ERROR", args);
  },
};

export function logCrash(type, err) {
  const message =
    err instanceof Error
      ? err.stack || err.message
      : util.format("%o", err);
  log.error(`❌ ${type}:`, message);
}

export function registerCrashHandlers({ onCrash } = {}) {
  if (crashHandlersRegistered) return;
  crashHandlersRegistered = true;

  const handleCrash = (type) => (err) => {
    logCrash(type, err);
    if (typeof onCrash === "function") {
      try {
        onCrash(err);
      } catch (handlerErr) {
        log.error("❌ Crash handler failed:", handlerErr);
      }
    }
  };

  process.on("uncaughtException", handleCrash("Uncaught Exception"));
  process.on("unhandledRejection", handleCrash("Unhandled Rejection"));
}

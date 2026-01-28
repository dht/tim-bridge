import path from "node:path";
import { createServerLogger as createLogger } from "tim-logger/server";
import { crud } from "./firestore.js";
import { setLogger } from "./globals.js";
import { guid4 } from "./guid.js";

const logPath = path.resolve(process.cwd(), "log.txt");

export const initLogger = (clientId) => {
  const logger = createLogger({
    source: clientId,
    transports: ["console", "fs", "custom"],
    fsPath: logPath,
    addLog: async (event) => {
      const record = event;
      const id = record.id ?? guid4();

      await crud("logs").update(id, { ...record, id });
    },
    clearLogs: async () => {
      await crud("logs").deleteByPredicate(() => true);
    },
  });

  setLogger(logger);

  return logger;
};

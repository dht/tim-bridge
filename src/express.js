import express from "express";
import { getLogger } from "./globals.js";
import { registerRoutes } from "./routes.js";

const BRIDGE_HTTP_PORT = Number(process.env.BRIDGE_HTTP_PORT || process.env.PORT || 3030);

export function startHttpServer() {
  const app = express();
  const logger = getLogger();
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Timestamp");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method == "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });

  const rawParser = express.raw({
    type: ["image/png", "image/jpeg", "application/octet-stream"],
    limit: "25mb",
  });

  const textParser = express.text({
    type: ["text/plain"],
    limit: "1mb",
  });

  registerRoutes(app, { rawParser, textParser });

  app.listen(BRIDGE_HTTP_PORT, () => {
    logger.info(`HTTP upload server listening on ${BRIDGE_HTTP_PORT}`);
  });
}

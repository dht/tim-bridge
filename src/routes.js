import fs from "fs-extra";
import os from "os";
import path from "path";
import { getLogger } from "./globals.js";

function sanitizeMachineId(machineId) {
  return machineId.replace(/[^a-zA-Z0-9-_]/g, "");
}

function resolveWebcamDir(machineId) {
  return path.join(os.homedir(), "projects", "tim-io", machineId, "webcam");
}

function contentTypeToExtension(contentType) {
  if (!contentType) return ".bin";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  return ".bin";
}

export function registerRoutes(app, { rawParser }) {
  const logger = getLogger();

  app.post("/:machineId/webcam", rawParser, async (req, res) => {
    try {
      const machineIdRaw = req.params.machineId || "";
      const machineId = sanitizeMachineId(machineIdRaw);

      if (!machineId) {
        return res.status(400).json({ ok: false, error: "missing-machine-id" });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ ok: false, error: "missing-body" });
      }

      const contentType = String(req.headers["content-type"] || "");
      const extension = contentTypeToExtension(contentType);
      const tsHeader = Number(req.headers["x-timestamp"]);
      const ts = Number.isFinite(tsHeader) ? tsHeader : Date.now();

      const dirPath = resolveWebcamDir(machineId);
      await fs.ensureDir(dirPath);

      const fileName = `webcam-${ts}${extension}`;
      const filePath = path.join(dirPath, fileName);

      await fs.writeFile(filePath, req.body);

      return res.json({ ok: true, fileName });
    } catch (err) {
      logger.error("Webcam upload failed", err);
      return res.status(500).json({ ok: false, error: "write-failed" });
    }
  });
}

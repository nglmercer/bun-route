import { Router } from "src/index";
import type { Request } from "src/types";
import type { FileInfo } from "./interfaces";
import type { ResponseBuilder } from "src/index";
import { existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { UPLOAD_DIR, MAX_FILE_SIZE } from "./state";
import { requireAuth, sendJson, getFileInfo, formatFileSize } from "./utils";

// Upload routes
export function registerUploadRoutes(router: Router): void {
  // Upload route with size limit
  router.post("/api/upload", async (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    // Check content length
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_FILE_SIZE) {
      res
        .status(413)
        .send(`File too large. Max size: ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        res.status(400).send("No file provided");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        res
          .status(413)
          .send(`File too large. Max size: ${formatFileSize(MAX_FILE_SIZE)}`);
        return;
      }

      // Sanitize filename
      const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filepath = join(UPLOAD_DIR, filename);

      // Write file
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(filepath, arrayBuffer);

      sendJson(res, {
        message: "File uploaded successfully",
        file: getFileInfo(filename),
      });
    } catch (err: unknown) {
      res
        .status(500)
        .send(
          "Upload failed: " +
            (err instanceof Error ? err.message : String(err)),
        );
    }
  });

  // List uploaded files
  router.get("/api/files", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    try {
      const files = readdirSync(UPLOAD_DIR)
        .map((name) => getFileInfo(name))
        .filter((f): f is FileInfo => f !== null)
        .sort((a, b) => b.uploadedAt - a.uploadedAt);

      sendJson(res, files);
    } catch {
      sendJson(res, []);
    }
  });

  // Delete file
  router.delete("/api/files/*", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    const filename = req.pathParams?.[0] || "";
    const filepath = join(UPLOAD_DIR, filename);

    if (!existsSync(filepath)) {
      res.status(404).send("File not found");
      return;
    }

    try {
      unlinkSync(filepath);
      sendJson(res, { message: "File deleted" });
    } catch {
      res.status(500).send("Failed to delete file");
    }
  });

  // Serve uploaded files (protected)
  router.get("/uploads/*", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    const filename = req.path.replace("/uploads/", "");
    const filepath = join(UPLOAD_DIR, filename);

    if (!existsSync(filepath)) {
      res.status(404).send("File not found");
      return;
    }

    res.send(Bun.file(filepath));
  });
}

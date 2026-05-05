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
  // Register file upload middleware for the upload endpoint
  // This automatically parses multipart/form-data and validates file size
  router.fileUpload("POST", "/api/upload", {
    maxSize: MAX_FILE_SIZE,
    allowedTypes: ["image/", "video/", "application/pdf", "text/"],
  });

  // Upload route — uses fileUpload middleware + named params
  router.post("/api/upload", async (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    // Get uploaded file using the new static helper
    const file = Router.getFile(req, "file");

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

    try {
      // Sanitize filename
      const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filepath = join(UPLOAD_DIR, filename);

      // Write file
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(filepath, arrayBuffer);

      // Get form fields if any
      const fields = Router.getFormFields(req);

      sendJson(res, {
        message: "File uploaded successfully",
        file: getFileInfo(filename),
        fields: Object.keys(fields).length > 0 ? fields : undefined,
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

  // List uploaded files — uses req.query() for pagination
  router.get("/api/files", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    try {
      const files = readdirSync(UPLOAD_DIR)
        .map((name) => getFileInfo(name))
        .filter((f): f is FileInfo => f !== null)
        .sort((a, b) => b.uploadedAt - a.uploadedAt);

      // Support pagination via query params
      const page = parseInt(req.query("page") as string) || 1;
      const limit = parseInt(req.query("limit") as string) || 50;
      const offset = (page - 1) * limit;
      const paginatedFiles = files.slice(offset, offset + limit);

      sendJson(res, {
        files: paginatedFiles,
        total: files.length,
        page,
        limit,
      });
    } catch {
      sendJson(res, { files: [], total: 0, page: 1, limit: 50 });
    }
  });

  // Delete file — uses named params instead of wildcards
  router.delete("/api/files/:filename", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    const params = req.pathParams as Record<string, string>;
    const filename = params?.filename || "";
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

  // Serve uploaded files — uses named params
  router.get("/uploads/:filename", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return;

    const params = req.pathParams as Record<string, string>;
    const filename = params?.filename || "";
    const filepath = join(UPLOAD_DIR, filename);

    if (!existsSync(filepath)) {
      res.status(404).send("File not found");
      return;
    }

    res.send(Bun.file(filepath));
  });
}

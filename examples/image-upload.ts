import { Router } from "../src/index";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

const router = new Router();
const UPLOAD_DIR = join(import.meta.dir, "uploads");
const MAX_SIZE = 10 * 1024 * 1024;

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

router.fileUpload("POST", "/upload", {
  maxSize: MAX_SIZE,
  allowedTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
});

router.post("/upload", async ({ req, res }) => {
  const file = Router.getFile(req, "image");
  if (!file) return res.status(400).send("No image provided");

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  await Bun.write(filepath, await file.arrayBuffer());
  res.json({ message: "Uploaded", filename, url: `/images/${filename}` });
});

router.get("/images", ({ res }) => {
  const files = readdirSync(UPLOAD_DIR)
    .filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f))
    .map((name) => {
      const stat = statSync(join(UPLOAD_DIR, name));
      return {
        name,
        size: stat.size,
        url: `/images/${name}`,
        uploadedAt: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
  res.json(files);
});

router.get("/images/:filename", ({ req, res }) => {
  const filename = req.pathParam("filename").string();
  if (!filename) return res.status(400).send("Missing filename");
  const filepath = join(UPLOAD_DIR, filename);
  if (!existsSync(filepath)) return res.status(404).send("Not found");
  res.send(Bun.file(filepath));
});

router.delete("/images/:filename", ({ req, res }) => {
  const filename = req.pathParam("filename").string();
  if (!filename) return res.status(400).send("Missing filename");
  const filepath = join(UPLOAD_DIR, filename);
  if (!existsSync(filepath)) return res.status(404).send("Not found");
  unlinkSync(filepath);
  res.json({ message: "Deleted" });
});

router.get("/", ({ res }) => {
  res.file(Bun.file(import.meta.dir + "/image-upload.html"));
});

export const server = Bun.serve({
  fetch: router.handle,
  port: 3005,
});

console.info(router.dump({ format: "compact" }, server));

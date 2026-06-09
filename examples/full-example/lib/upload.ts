import { Router, handlerName } from "../../../src/index"
import type { Router as RouterType } from "../../../src/index"

export function registerUploadRoutes(router: RouterType): void {
  router.fileUpload("POST", "/api/upload", {
    maxSize: 5_000_000,
    allowedTypes: ["image/png", "image/jpeg", "text/plain"],
  })

  router.post("/api/upload", handlerName("uploadFile", ({ req, res }) => {
    const file = Router.getFile(req, "file")
    const fields = Router.getFormFields(req)
    if (!file) return res.status(400).json({ error: "No file uploaded" })
    res.json({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      formFields: fields,
      message: "File uploaded successfully",
    })
  }))

  router.post("/api/upload/multi", handlerName("uploadMultiple", ({ req, res }) => {
    const fieldNames = Router.getFileFieldNames(req)
    const result: Record<string, unknown[]> = {}
    for (const name of fieldNames) {
      result[name] = Router.getFiles(req, name).map(f => ({ name: f.name, type: f.type, size: f.size }))
    }
    res.json({ uploaded: result })
  }))
}

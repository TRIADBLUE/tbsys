import { Router } from "express";
import { eq, desc, and, SQL } from "drizzle-orm";
import { assets } from "../../shared/schema";
import type { AuditService } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "path";
import fs from "fs";

export function createAssetRoutes(
  db: NodePgDatabase,
  auditService: AuditService,
) {
  const router = Router();

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // GET /api/assets
  router.get("/", async (req, res, next) => {
    try {
      const conditions: SQL[] = [];

      if (req.query.projectId) {
        conditions.push(
          eq(assets.projectId, parseInt(req.query.projectId as string, 10)),
        );
      }
      if (req.query.category) {
        conditions.push(eq(assets.category, req.query.category as any));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string, 10)
        : 0;

      const rows = await db
        .select()
        .from(assets)
        .where(where)
        .orderBy(desc(assets.createdAt))
        .limit(limit)
        .offset(offset);

      const all = await db.select({ id: assets.id }).from(assets).where(where);

      res.json({ assets: rows, total: all.length });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/assets/upload
  router.post("/upload", async (req, res, next) => {
    try {
      // Handle raw body upload with metadata in headers
      const filename = (req.headers["x-filename"] as string) || "upload";
      const mimeType =
        (req.headers["content-type"] as string) || "application/octet-stream";
      const projectId = req.headers["x-project-id"]
        ? parseInt(req.headers["x-project-id"] as string, 10)
        : null;
      // Auto-detect category from mime type if not specified
      const headerCategory = req.headers["x-category"] as string | undefined;
      const category = headerCategory || (
        mimeType.startsWith("image/") ? "screenshot" : "document"
      );

      // Collect body chunks
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const safeName = filename
            .replace(/[^a-zA-Z0-9._-]/g, "-")
            .toLowerCase();
          const storagePath = path.join(
            uploadsDir,
            `${Date.now()}-${safeName}`,
          );

          fs.writeFileSync(storagePath, buffer);

          const [asset] = await db
            .insert(assets)
            .values({
              projectId,
              filename: safeName,
              mimeType,
              sizeBytes: buffer.length,
              storagePath,
              category: category as any,
            })
            .returning();

          await auditService.log({
            action: "create",
            entityType: "asset",
            entityId: asset.id,
            newValue: { filename: safeName, mimeType, sizeBytes: buffer.length },
          });

          res.status(201).json({ asset });
        } catch (err) {
          next(err);
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/assets/file/:id — serve the actual uploaded file
  router.get("/file/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [asset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, id))
        .limit(1);

      if (!asset) {
        return res.status(404).json({ error: "Not Found" });
      }

      if (!fs.existsSync(asset.storagePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${asset.filename}"`);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const stream = fs.createReadStream(asset.storagePath);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/assets/:id
  router.delete("/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [existing] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, id))
        .limit(1);

      if (!existing) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Asset not found" });
      }

      // Delete file from disk
      if (fs.existsSync(existing.storagePath)) {
        fs.unlinkSync(existing.storagePath);
      }

      await db.delete(assets).where(eq(assets.id, id));

      await auditService.log({
        action: "delete",
        entityType: "asset",
        entityId: id,
        previousValue: existing,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

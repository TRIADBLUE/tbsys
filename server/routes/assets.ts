import { Router } from "express";
import { eq, desc, and, SQL } from "drizzle-orm";
import { assets } from "../../shared/schema";
import type { AuditService } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import fs from "fs";

// Public router: serves asset file bytes without auth. Mount FIRST so the
// authRequired middleware on /api/assets doesn't block favicon/og-image loads
// from anonymous browsers hitting other TRIADBLUE sites via OGA.
export function createPublicAssetRoutes(db: NodePgDatabase) {
  const router = Router();

  // GET /api/assets/file/:id — serve the actual uploaded file (public)
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

      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${asset.filename}"`);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (asset.data) {
        res.setHeader("Content-Length", asset.data.length);
        return res.send(asset.data);
      }

      if (asset.storagePath && fs.existsSync(asset.storagePath)) {
        const stat = fs.statSync(asset.storagePath);
        res.setHeader("Last-Modified", stat.mtime.toUTCString());
        const stream = fs.createReadStream(asset.storagePath);
        return stream.pipe(res);
      }

      return res.status(404).json({ error: "File data not available" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createAssetRoutes(
  db: NodePgDatabase,
  auditService: AuditService,
) {
  const router = Router();

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
        .select({
          id: assets.id,
          projectId: assets.projectId,
          filename: assets.filename,
          mimeType: assets.mimeType,
          sizeBytes: assets.sizeBytes,
          storagePath: assets.storagePath,
          category: assets.category,
          uploadedBy: assets.uploadedBy,
          metadata: assets.metadata,
          createdAt: assets.createdAt,
        })
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
  // Note: express.json() is skipped for this route (see server/index.ts)
  router.post("/upload", async (req, res, next) => {
    try {
      const filename = (req.headers["x-filename"] as string) || "upload";
      const mimeType =
        (req.headers["content-type"] as string) || "application/octet-stream";
      const projectId = req.headers["x-project-id"]
        ? parseInt(req.headers["x-project-id"] as string, 10)
        : null;
      const headerCategory = req.headers["x-category"] as string | undefined;
      const category = headerCategory || (
        mimeType.startsWith("image/") ? "screenshot" : "document"
      );

      // Collect the raw body
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });

      if (buffer.length === 0) {
        return res.status(400).json({ error: "Empty file" });
      }

      const safeName = filename
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();

      // Store file data directly in the database
      const [asset] = await db
        .insert(assets)
        .values({
          projectId,
          filename: safeName,
          mimeType,
          sizeBytes: buffer.length,
          data: buffer,
          category: category as any,
        })
        .returning({
          id: assets.id,
          projectId: assets.projectId,
          filename: assets.filename,
          mimeType: assets.mimeType,
          sizeBytes: assets.sizeBytes,
          category: assets.category,
          uploadedBy: assets.uploadedBy,
          metadata: assets.metadata,
          createdAt: assets.createdAt,
        });

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

      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${asset.filename}"`);
      res.setHeader("Cache-Control", "public, max-age=3600");

      // Serve from database if data exists
      if (asset.data) {
        res.setHeader("Content-Length", asset.data.length);
        return res.send(asset.data);
      }

      // Fallback: serve from filesystem (legacy records)
      if (asset.storagePath && fs.existsSync(asset.storagePath)) {
        const stat = fs.statSync(asset.storagePath);
        res.setHeader("Last-Modified", stat.mtime.toUTCString());
        const stream = fs.createReadStream(asset.storagePath);
        return stream.pipe(res);
      }

      return res.status(404).json({ error: "File data not available" });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/assets/:id
  router.delete("/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [existing] = await db
        .select({
          id: assets.id,
          filename: assets.filename,
          mimeType: assets.mimeType,
          sizeBytes: assets.sizeBytes,
          storagePath: assets.storagePath,
          category: assets.category,
        })
        .from(assets)
        .where(eq(assets.id, id))
        .limit(1);

      if (!existing) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Asset not found" });
      }

      // Delete file from disk if it exists (legacy cleanup)
      if (existing.storagePath && fs.existsSync(existing.storagePath)) {
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

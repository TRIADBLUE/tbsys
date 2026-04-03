import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { ogaSites, ogaAssets } from "../../shared/schema";
import {
  insertOgaSiteSchema,
  updateOgaSiteSchema,
  upsertOgaAssetsSchema,
} from "../../shared/validators";
import { validateBody } from "../middleware/validation";
import { createAuthMiddleware } from "../middleware/auth";
import type { AuditService } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import crypto from "crypto";

function generateApiKey(): string {
  return `oga_${crypto.randomBytes(32).toString("hex")}`;
}

function extractRootDomain(domain: string): string | null {
  // Remove protocol if present
  const clean = domain.replace(/^https?:\/\//, "").split("/")[0];
  const parts = clean.split(".");
  // If it's already a root domain (e.g. "example.com"), return null
  if (parts.length <= 2) return null;
  // Return the root domain (last two parts)
  return parts.slice(-2).join(".");
}

export function createOgaRoutes(
  db: NodePgDatabase,
  auditService: AuditService,
) {
  const router = Router();

  // ── Public Endpoints (API key auth) ──────────────────

  // GET /api/oga/config?key=XXX
  router.get("/config", async (req, res) => {
    const key = req.query.key as string;
    if (!key) {
      return res.status(401).json({ error: "API key required" });
    }

    // Look up site by API key
    let [site] = await db
      .select()
      .from(ogaSites)
      .where(eq(ogaSites.apiKey, key))
      .limit(1);

    if (!site) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (site.status === "disabled") {
      return res.status(403).json({ error: "Site is disabled" });
    }

    // If this is a non-emancipated subdomain, fall back to parent domain
    let assetsFromSiteId = site.id;
    const rootDomain = extractRootDomain(site.domain);

    if (!site.emancipated && rootDomain) {
      const [parent] = await db
        .select()
        .from(ogaSites)
        .where(eq(ogaSites.domain, rootDomain))
        .limit(1);

      if (parent && parent.status === "active") {
        assetsFromSiteId = parent.id;
      }
    }

    // Fetch assets
    const assets = await db
      .select()
      .from(ogaAssets)
      .where(
        and(
          eq(ogaAssets.siteId, assetsFromSiteId),
          eq(ogaAssets.enabled, true),
        ),
      );

    // Build config response
    const assetMap: Record<string, string> = {};
    for (const a of assets) {
      // Convert "logo-image-16px" to "logoImage16px" camelCase key
      const camelKey = a.assetType.replace(/-([a-z0-9])/g, (_, c) =>
        c.toUpperCase(),
      );
      assetMap[camelKey] = a.value;
    }

    // Update fetch stats (async, don't block response)
    db.update(ogaSites)
      .set({
        lastFetchedAt: new Date(),
        fetchCount: sql`${ogaSites.fetchCount} + 1`,
      })
      .where(eq(ogaSites.id, site.id))
      .catch(() => {});

    // Set CORS headers
    const origin = req.headers.origin;
    const allowedOrigins = (site.allowedOrigins || []) as string[];
    if (
      allowedOrigins.length === 0 ||
      (origin && allowedOrigins.includes(origin))
    ) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cache-Control", "public, max-age=300");

    res.json({
      domain: site.domain,
      siteName: site.displayName,
      assets: assetMap,
      updatedAt: site.updatedAt.toISOString(),
    });
  });

  // OPTIONS /api/oga/config (CORS preflight)
  router.options("/config", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  // GET /api/oga/embed.js?key=XXX
  router.get("/embed.js", async (req, res) => {
    const key = req.query.key as string;
    if (!key) {
      res.setHeader("Content-Type", "application/javascript");
      return res.send("/* OGA: no API key provided */");
    }

    const configUrl = `${req.protocol}://${req.get("host")}/api/oga/config?key=${encodeURIComponent(key)}`;

    const script = `(function(){
  "use strict";
  var CACHE_KEY="oga_config";
  var CACHE_TTL=300000;
  var CONFIG_URL="${configUrl}";

  function apply(cfg){
    if(!cfg||!cfg.assets)return;
    var h=document.head;
    var a=cfg.assets;

    // Remove existing favicons
    var old=h.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]');
    for(var i=0;i<old.length;i++)old[i].parentNode.removeChild(old[i]);

    function addLink(rel,href,sizes){
      if(!href)return;
      var l=document.createElement("link");
      l.rel=rel;l.href=href;
      if(sizes)l.setAttribute("sizes",sizes);
      h.appendChild(l);
    }
    function setMeta(name,content,prop){
      if(!content)return;
      var sel=prop?'meta[property="'+name+'"]':'meta[name="'+name+'"]';
      var m=h.querySelector(sel);
      if(!m){m=document.createElement("meta");if(prop)m.setAttribute("property",name);else m.name=name;h.appendChild(m);}
      m.content=content;
    }

    addLink("icon",a.logoImage16px,"16x16");
    addLink("icon",a.logoImage32px,"32x32");
    addLink("icon",a.logoImageIcon);
    addLink("apple-touch-icon",a.logoImage180px,"180x180");
    setMeta("theme-color",a.themeColor);
    setMeta("og:image",a.ogImage,true);
    if(a.siteName)setMeta("og:site_name",a.siteName,true);
    if(cfg.siteName)setMeta("og:site_name",cfg.siteName,true);
  }

  try{
    var cached=sessionStorage.getItem(CACHE_KEY);
    if(cached){
      var p=JSON.parse(cached);
      if(p.ts&&Date.now()-p.ts<CACHE_TTL){apply(p.data);return;}
    }
  }catch(e){}

  fetch(CONFIG_URL).then(function(r){return r.json()}).then(function(data){
    apply(data);
    try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),data:data}));}catch(e){}
  }).catch(function(){});
})();`;

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(script);
  });

  // ── Admin Endpoints (require session auth) ──────────
  const authRequired = createAuthMiddleware(db);
  router.use("/sites", authRequired);

  // GET /api/oga/sites
  router.get("/sites", async (req, res, next) => {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string, 10)
        : 0;

      const sites = await db
        .select()
        .from(ogaSites)
        .orderBy(desc(ogaSites.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ogaSites);

      res.json({ sites, total: count });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/oga/sites
  router.post(
    "/sites",
    validateBody(insertOgaSiteSchema),
    async (req, res, next) => {
      try {
        const data = req.body;
        const apiKey = generateApiKey();

        // Auto-detect parent domain for subdomains
        const rootDomain = extractRootDomain(data.domain);
        const isRootDomain = !rootDomain;

        const [site] = await db
          .insert(ogaSites)
          .values({
            ...data,
            apiKey,
            emancipated: data.emancipated ?? isRootDomain, // Root domains are always emancipated
            parentDomain: rootDomain,
          })
          .returning();

        await auditService.log({
          action: "create",
          entityType: "oga_site",
          entityId: site.id,
          newValue: { domain: site.domain, displayName: site.displayName },
        });

        res.status(201).json({ site });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/oga/sites/:id
  router.get("/sites/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string, 10);

      const [site] = await db
        .select()
        .from(ogaSites)
        .where(eq(ogaSites.id, id))
        .limit(1);

      if (!site) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Site not found" });
      }

      const assets = await db
        .select()
        .from(ogaAssets)
        .where(eq(ogaAssets.siteId, id))
        .orderBy(ogaAssets.displayOrder);

      res.json({ site, assets });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/oga/sites/:id
  router.patch(
    "/sites/:id",
    validateBody(updateOgaSiteSchema),
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id as string, 10);

        const [updated] = await db
          .update(ogaSites)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(ogaSites.id, id))
          .returning();

        if (!updated) {
          return res
            .status(404)
            .json({ error: "Not Found", message: "Site not found" });
        }

        await auditService.log({
          action: "update",
          entityType: "oga_site",
          entityId: id,
          newValue: req.body,
        });

        res.json({ site: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/oga/sites/:id
  router.delete("/sites/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string, 10);

      const [deleted] = await db
        .delete(ogaSites)
        .where(eq(ogaSites.id, id))
        .returning();

      if (!deleted) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Site not found" });
      }

      await auditService.log({
        action: "delete",
        entityType: "oga_site",
        entityId: id,
        previousValue: { domain: deleted.domain },
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/oga/sites/:id/regenerate-key
  router.post("/sites/:id/regenerate-key", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const newKey = generateApiKey();

      const [updated] = await db
        .update(ogaSites)
        .set({ apiKey: newKey, updatedAt: new Date() })
        .where(eq(ogaSites.id, id))
        .returning();

      if (!updated) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Site not found" });
      }

      await auditService.log({
        action: "update",
        entityType: "oga_site",
        entityId: id,
        newValue: { action: "regenerate_key" },
      });

      res.json({ site: updated });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/oga/sites/:id/emancipate
  router.post("/sites/:id/emancipate", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string, 10);

      const [updated] = await db
        .update(ogaSites)
        .set({ emancipated: true, updatedAt: new Date() })
        .where(eq(ogaSites.id, id))
        .returning();

      if (!updated) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Site not found" });
      }

      await auditService.log({
        action: "update",
        entityType: "oga_site",
        entityId: id,
        newValue: { action: "emancipate", domain: updated.domain },
      });

      res.json({ site: updated });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/oga/sites/:id/assets — Upsert assets (bulk)
  router.post(
    "/sites/:id/assets",
    validateBody(upsertOgaAssetsSchema),
    async (req, res, next) => {
      try {
        const siteId = parseInt(req.params.id as string, 10);

        // Verify site exists
        const [site] = await db
          .select({ id: ogaSites.id })
          .from(ogaSites)
          .where(eq(ogaSites.id, siteId))
          .limit(1);

        if (!site) {
          return res
            .status(404)
            .json({ error: "Not Found", message: "Site not found" });
        }

        const results = [];

        for (const asset of req.body.assets) {
          // Try to update existing
          const [existing] = await db
            .select()
            .from(ogaAssets)
            .where(
              and(
                eq(ogaAssets.siteId, siteId),
                eq(ogaAssets.assetType, asset.assetType),
              ),
            )
            .limit(1);

          if (existing) {
            const [updated] = await db
              .update(ogaAssets)
              .set({
                value: asset.value,
                mimeType: asset.mimeType ?? existing.mimeType,
                enabled: asset.enabled ?? existing.enabled,
                updatedAt: new Date(),
              })
              .where(eq(ogaAssets.id, existing.id))
              .returning();
            results.push(updated);
          } else {
            const [created] = await db
              .insert(ogaAssets)
              .values({
                siteId,
                assetType: asset.assetType,
                value: asset.value,
                mimeType: asset.mimeType ?? null,
                enabled: asset.enabled ?? true,
              })
              .returning();
            results.push(created);
          }
        }

        // Update site's updatedAt
        await db
          .update(ogaSites)
          .set({ updatedAt: new Date() })
          .where(eq(ogaSites.id, siteId));

        await auditService.log({
          action: "update",
          entityType: "oga_assets",
          entityId: siteId,
          newValue: {
            assetTypes: req.body.assets.map(
              (a: { assetType: string }) => a.assetType,
            ),
          },
        });

        res.json({ assets: results });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/oga/sites/:siteId/assets/:assetId
  router.delete("/sites/:siteId/assets/:assetId", async (req, res, next) => {
    try {
      const assetId = parseInt(req.params.assetId as string, 10);

      const [deleted] = await db
        .delete(ogaAssets)
        .where(eq(ogaAssets.id, assetId))
        .returning();

      if (!deleted) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Asset not found" });
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

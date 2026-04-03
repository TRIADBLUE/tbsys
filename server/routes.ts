import type { Express } from "express";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { CacheService } from "./services/cache.service";
import { AuditService } from "./services/audit.service";
import { SyncService } from "./services/sync.service";
import { createAuthMiddleware } from "./middleware/auth";
import { createProjectRoutes } from "./routes/projects";
import { createProjectSettingsRoutes } from "./routes/project-settings";
import { createProjectColorRoutes } from "./routes/project-colors";
import { createGithubRoutes } from "./routes/github";
import { createUserPreferencesRoutes } from "./routes/user-preferences";
import { createHealthRoutes } from "./routes/health";
import { createAuditRoutes } from "./routes/audit";
import { createAuthRoutes } from "./routes/auth";
import { createNotificationRoutes } from "./routes/notifications";
import { createSharedDocRoutes } from "./routes/shared-docs";
import { createProjectDocRoutes } from "./routes/project-docs";
import { createDocPushRoutes } from "./routes/doc-push";
import { createDocGeneratorRoutes } from "./routes/doc-generator";
import { createTaskRoutes } from "./routes/tasks";
import { createSitePlannerRoutes } from "./routes/site-planner";
import { createChatRoutes } from "./routes/chat";
import { createDashboardRoutes } from "./routes/dashboard";
import { createAnalyticsRoutes } from "./routes/analytics";
import { createAssetRoutes } from "./routes/assets";
import { createLinkMonitorRoutes } from "./routes/link-monitor";
import { createTeamRoutes } from "./routes/team";
import { createOgaRoutes } from "./routes/oga";
import { errorHandler } from "./middleware/error-handler";

export function registerRoutes(app: Express, db: NodePgDatabase) {
  // Initialize services
  const cacheService = new CacheService(db);
  const auditService = new AuditService(db);
  const syncService = new SyncService(db, cacheService, auditService);
  const authRequired = createAuthMiddleware(db);

  // ── API Routes ─────────────────────────────────────
  // IMPORTANT: Register all API routes BEFORE the SPA catch-all

  // ── Public routes (no auth) ──────────────────────
  app.use("/api/auth", createAuthRoutes(db));
  app.use("/api/health", createHealthRoutes(db, cacheService));

  // OGA public endpoints are handled inside the OGA router
  // (config and embed.js are key-authenticated, admin endpoints need session)
  app.use("/api/oga", createOgaRoutes(db, auditService));

  // ── Protected routes (require session or API key) ──
  app.use("/api/projects", authRequired, createProjectRoutes(db, auditService));

  app.use(
    "/api/projects/:idOrSlug/settings",
    authRequired,
    createProjectSettingsRoutes(db, auditService),
  );

  app.use(
    "/api/projects/:idOrSlug/colors",
    authRequired,
    createProjectColorRoutes(db, auditService),
  );

  app.use("/api/github", authRequired, createGithubRoutes(cacheService, auditService));

  app.use("/api/user/preferences", authRequired, createUserPreferencesRoutes(db));

  app.use("/api/audit", authRequired, createAuditRoutes(auditService));

  app.use("/api/notifications", authRequired, createNotificationRoutes(db));

  app.use("/api/docs/shared", authRequired, createSharedDocRoutes(db, auditService));

  app.use(
    "/api/projects/:idOrSlug/docs",
    authRequired,
    createProjectDocRoutes(db, auditService),
  );

  app.use(
    "/api/projects/:idOrSlug/docs/push",
    authRequired,
    createDocPushRoutes(db, auditService),
  );

  app.use("/api/doc-generator", authRequired, createDocGeneratorRoutes(db, auditService));

  app.use(
    "/api/projects/:idOrSlug/generate-docs",
    authRequired,
    createDocGeneratorRoutes(db, auditService),
  );

  app.use("/api/tasks", authRequired, createTaskRoutes(db, auditService));

  app.use(
    "/api/projects/:idOrSlug/site-plan",
    authRequired,
    createSitePlannerRoutes(db, auditService),
  );

  app.use("/api/chat", authRequired, createChatRoutes(db, auditService));

  app.use("/api/dashboard", authRequired, createDashboardRoutes(db, auditService));

  app.use("/api/analytics", authRequired, createAnalyticsRoutes(db, auditService));

  app.use("/api/assets", authRequired, createAssetRoutes(db, auditService));

  app.use("/api/link-monitor", authRequired, createLinkMonitorRoutes(db, auditService));

  app.use("/api/team", authRequired, createTeamRoutes(db, auditService));

  // ── Error Handler ──────────────────────────────────
  app.use(errorHandler);

  // ── Background Sync ────────────────────────────────
  const syncInterval = parseInt(
    process.env.SYNC_INTERVAL_MINUTES || "30",
    10,
  );
  syncService.start(syncInterval);

  // Cache cleanup every 15 minutes
  setInterval(
    async () => {
      try {
        const cleaned = await cacheService.cleanup();
        if (cleaned > 0) {
          console.log(`[cache] Cleaned ${cleaned} expired entries`);
        }
      } catch (err) {
        // Silent cleanup failure
      }
    },
    15 * 60 * 1000,
  );

  return { cacheService, auditService, syncService };
}

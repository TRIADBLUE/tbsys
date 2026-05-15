import { Router } from "express";
import { eq } from "drizzle-orm";
import { projects } from "../../shared/schema";
import { DocGeneratorService } from "../services/doc-generator.service";
import { requireDocWritersEnabled } from "../middleware/doc-writers-gate";
import type { AuditService } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createDocGeneratorRoutes(
  db: NodePgDatabase,
  auditService: AuditService,
) {
  const router = Router({ mergeParams: true });
  const docGenerator = new DocGeneratorService(db, auditService);

  // Helper: resolve project from :idOrSlug param
  async function resolveProject(idOrSlug: string) {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const condition = isNumeric
      ? eq(projects.id, parseInt(idOrSlug, 10))
      : eq(projects.slug, idOrSlug);
    const rows = await db.select().from(projects).where(condition).limit(1);
    return rows[0] || null;
  }

  // GET /api/doc-generator/templates
  // List available auto-generation templates
  router.get("/templates", async (_req, res) => {
    try {
      const templates = docGenerator.getTemplates();
      res.json({ templates });
    } catch (err) {
      console.error("[doc-generator] Error fetching templates:", err);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // POST /api/projects/:idOrSlug/generate-docs
  // Trigger auto-generation for a specific project
  router.post("/", requireDocWritersEnabled, async (req, res) => {
    try {
      const project = await resolveProject(req.params.idOrSlug as string);

      if (!project) {
        return res.status(404).json({
          error: "Not Found",
          message: `Project "${req.params.idOrSlug}" not found`,
        });
      }

      const result = await docGenerator.generateForNewProject(project.id);

      res.status(201).json({
        success: true,
        projectSlug: project.slug,
        projectName: project.displayName,
        ...result,
      });
    } catch (err: any) {
      console.error("[doc-generator] Error generating docs:", err);
      res.status(500).json({
        error: "Failed to generate docs",
        details: err.message,
      });
    }
  });

  // POST /api/projects/:idOrSlug/generate-docs/regenerate
  // Regenerate (update) existing auto-generated docs
  router.post("/regenerate", requireDocWritersEnabled, async (req, res) => {
    try {
      const project = await resolveProject(req.params.idOrSlug as string);

      if (!project) {
        return res.status(404).json({
          error: "Not Found",
          message: `Project "${req.params.idOrSlug}" not found`,
        });
      }

      const result = await docGenerator.regenerateForProject(project.id);

      res.json({
        success: true,
        projectSlug: project.slug,
        ...result,
      });
    } catch (err: any) {
      console.error("[doc-generator] Error regenerating docs:", err);
      res.status(500).json({
        error: "Failed to regenerate docs",
        details: err.message,
      });
    }
  });

  return router;
}

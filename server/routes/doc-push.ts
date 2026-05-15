import { Router } from "express";
import { eq, asc, desc } from "drizzle-orm";
import {
  projects,
  sharedDocs,
  projectDocs,
  docPushLog,
} from "../../shared/schema";
import { docPushSchema } from "../../shared/validators";
import { validateBody } from "../middleware/validation";
import { requireDocWritersEnabled } from "../middleware/doc-writers-gate";
import { githubService } from "../services/github.service";
import type { AuditService } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createDocPushRoutes(
  db: NodePgDatabase,
  auditService: AuditService,
) {
  const router = Router({ mergeParams: true });

  // Helper: resolve project from :idOrSlug
  async function resolveProject(idOrSlug: string) {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const condition = isNumeric
      ? eq(projects.id, parseInt(idOrSlug, 10))
      : eq(projects.slug, idOrSlug);

    const rows = await db.select().from(projects).where(condition).limit(1);
    return rows[0] || null;
  }

  // Helper: assemble CLAUDE.md content
  async function assembleContent(projectId: number) {
    const shared = await db
      .select()
      .from(sharedDocs)
      .where(eq(sharedDocs.enabled, true))
      .orderBy(asc(sharedDocs.displayOrder));

    const projectSpecific = await db
      .select()
      .from(projectDocs)
      .where(eq(projectDocs.projectId, projectId))
      .orderBy(asc(projectDocs.displayOrder));

    const enabledProjectDocs = projectSpecific.filter((d) => d.enabled);

    const sections: string[] = [];

    // Shared docs first
    for (const doc of shared) {
      sections.push(`# ${doc.title}\n\n${doc.content}`);
    }

    // Project-specific docs
    for (const doc of enabledProjectDocs) {
      sections.push(`# ${doc.title}\n\n${doc.content}`);
    }

    return {
      assembledContent: sections.join("\n\n---\n\n"),
      sharedDocs: shared.map((d) => ({ title: d.title, slug: d.slug })),
      projectDocs: enabledProjectDocs.map((d) => ({
        title: d.title,
        slug: d.slug,
      })),
    };
  }

  // GET /api/projects/:idOrSlug/docs/push/preview
  router.get("/preview", async (req, res, next) => {
    try {
      const project = await resolveProject(req.params.idOrSlug);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const preview = await assembleContent(project.id);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/projects/:idOrSlug/docs/push
  router.post(
    "/",
    requireDocWritersEnabled,
    validateBody(docPushSchema),
    async (req, res, next) => {
      try {
        const project = await resolveProject(req.params.idOrSlug);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }

        if (!project.githubRepo) {
          return res.status(400).json({
            error: "Project has no GitHub repository configured",
          });
        }

        if (!githubService.isConfigured) {
          return res.status(500).json({
            error: "GitHub token not configured",
          });
        }

        const { targetPath, commitMessage } = req.body as {
          targetPath: string;
          commitMessage?: string;
        };

        // Guard: Console.Blue's own CLAUDE.md is hand-edited and must not be
        // overwritten by the Doc Planner assembly. Every other project can push
        // normally. If you need to push Console.Blue docs to GitHub, use a
        // different targetPath (e.g., docs/assembled-docs.md).
        const normalizedPath = targetPath.replace(/^\/+/, "").toUpperCase();
        if (
          project.slug === "consoleblue" &&
          normalizedPath === "CLAUDE.MD"
        ) {
          return res.status(409).json({
            error:
              "Console.Blue's CLAUDE.md is hand-edited. Doc Planner is blocked from overwriting it. Use a different targetPath (e.g., docs/assembled-docs.md) or edit CLAUDE.md directly in the repo.",
          });
        }

        const { assembledContent } = await assembleContent(project.id);

        const message =
          commitMessage ||
          `Update ${targetPath} via ConsoleBlue`;

        try {
          const result = await githubService.pushFile({
            repo: project.githubRepo,
            path: targetPath,
            content: assembledContent,
            message,
            branch: project.defaultBranch || undefined,
          });

          // Log success
          await db.insert(docPushLog).values({
            projectId: project.id,
            targetRepo: project.githubRepo,
            targetPath,
            commitSha: result.commitSha,
            assembledContent,
            status: "success",
          });

          await auditService.log({
            action: "create",
            entityType: "doc_push",
            entityId: project.id,
            entitySlug: project.slug,
            newValue: {
              targetRepo: project.githubRepo,
              targetPath,
              commitSha: result.commitSha,
            },
          });

          res.json({
            success: true,
            commitSha: result.commitSha,
            commitUrl: result.commitUrl,
            targetRepo: project.githubRepo,
            targetPath,
          });
        } catch (pushErr: any) {
          // Log failure
          await db.insert(docPushLog).values({
            projectId: project.id,
            targetRepo: project.githubRepo,
            targetPath,
            assembledContent,
            status: "error",
            errorMessage: pushErr.message || "Unknown push error",
          });

          return res.status(502).json({
            error: "GitHub push failed",
            details: pushErr.message,
          });
        }
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/projects/:idOrSlug/docs/push/history
  router.get("/history", async (req, res, next) => {
    try {
      const project = await resolveProject(req.params.idOrSlug);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const limit = Math.min(
        parseInt(req.query.limit as string, 10) || 20,
        100,
      );
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const entries = await db
        .select()
        .from(docPushLog)
        .where(eq(docPushLog.projectId, project.id))
        .orderBy(desc(docPushLog.pushedAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const allEntries = await db
        .select({ id: docPushLog.id })
        .from(docPushLog)
        .where(eq(docPushLog.projectId, project.id));

      res.json({
        entries,
        total: allEntries.length,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

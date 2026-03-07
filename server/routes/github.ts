import { Router } from "express";
import { githubService } from "../services/github.service";
import { githubCacheMiddleware } from "../middleware/github-cache";
import { requireApiKey } from "../middleware/api-key";
import type { CacheService } from "../services/cache.service";
import type { AuditService } from "../services/audit.service";

export function createGithubRoutes(
  cacheService: CacheService,
  auditService: AuditService,
) {
  const router = Router();

  // All GitHub routes require API key for external access
  router.use(requireApiKey);

  // GET /api/github/repos
  router.get(
    "/repos",
    githubCacheMiddleware(cacheService, "repos"),
    async (_req, res, next) => {
      try {
        const repos = await githubService.listRepos();
        res.json({ count: repos.length, repos });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/github/tree?repo=X&path=Y
  router.get(
    "/tree",
    githubCacheMiddleware(cacheService, "tree"),
    async (req, res, next) => {
      try {
        const repo = req.query.repo as string;
        if (!repo) {
          return res
            .status(400)
            .json({ error: "Bad Request", message: "repo parameter required" });
        }

        const path = (req.query.path as string) || "";
        const result = await githubService.getTree(repo, path);

        res.json({ repo, path, ...result });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/github/file?repo=X&path=Y
  router.get(
    "/file",
    githubCacheMiddleware(cacheService, "file"),
    async (req, res, next) => {
      try {
        const repo = req.query.repo as string;
        const path = req.query.path as string;
        if (!repo || !path) {
          return res.status(400).json({
            error: "Bad Request",
            message: "repo and path parameters required",
          });
        }

        const file = await githubService.getFileContent(repo, path);
        res.json(file);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/github/routes?repo=X
  router.get(
    "/routes",
    githubCacheMiddleware(cacheService, "routes"),
    async (req, res, next) => {
      try {
        const repo = req.query.repo as string;
        if (!repo) {
          return res
            .status(400)
            .json({ error: "Bad Request", message: "repo parameter required" });
        }

        const result = await githubService.extractRoutes(repo);
        res.json({ repo, ...result });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/github/commits?repo=X&count=N
  router.get(
    "/commits",
    githubCacheMiddleware(cacheService, "commits"),
    async (req, res, next) => {
      try {
        const repo = req.query.repo as string;
        if (!repo) {
          return res
            .status(400)
            .json({ error: "Bad Request", message: "repo parameter required" });
        }

        const count = parseInt(req.query.count as string, 10) || 10;
        const commits = await githubService.getCommits(repo, count);

        res.json({ repo, count: commits.length, commits });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/github/search?repo=X&query=Q&path=P
  router.get(
    "/search",
    githubCacheMiddleware(cacheService, "search"),
    async (req, res, next) => {
      try {
        const repo = req.query.repo as string;
        const query = req.query.query as string;
        if (!repo || !query) {
          return res.status(400).json({
            error: "Bad Request",
            message: "repo and query parameters required",
          });
        }

        const path = (req.query.path as string) || "";
        const files = await githubService.searchFiles(repo, query, path);

        res.json({ repo, query, path, count: files.length, files });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/github/push-file — commit a file to a repo
  router.post("/push-file", async (req, res, next) => {
    try {
      const { repo, path, content, message, branch } = req.body || {};
      if (!repo || !path || !content || !message) {
        return res.status(400).json({
          error: "Bad Request",
          message: "repo, path, content, and message are required",
        });
      }

      const result = await githubService.pushFile({
        repo,
        path,
        content,
        message,
        branch,
      });

      await auditService.log({
        action: "push_file",
        entityType: "github_file",
        metadata: { repo, path, branch, commitSha: result.commitSha },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/github/sync — manual sync trigger
  router.post("/sync", async (req, res, next) => {
    try {
      const { projectId, repo } = req.body || {};
      const synced: { repo: string; updatedFields: string[] }[] = [];
      const errors: { repo: string; error: string }[] = [];

      if (repo) {
        // Sync single repo
        try {
          await cacheService.invalidateByRepo(repo);
          synced.push({ repo, updatedFields: ["cache_cleared"] });
        } catch (err) {
          errors.push({
            repo,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } else {
        // Sync all — clear entire cache
        try {
          const cleaned = await cacheService.cleanup();
          synced.push({
            repo: "*",
            updatedFields: [`${cleaned}_cache_entries_cleared`],
          });
        } catch (err) {
          errors.push({
            repo: "*",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      await auditService.log({
        action: "sync",
        entityType: "github_sync",
        metadata: { projectId, repo, synced, errors },
      });

      res.json({ synced, errors });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

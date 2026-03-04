import { Router } from "express";
import { TaskService } from "../services/task.service";
import {
  insertTaskSchema,
  updateTaskSchema,
  reorderTasksSchema,
  insertTaskNoteSchema,
  insertTaskHighlightSchema,
} from "../../shared/validators";
import { validateBody } from "../middleware/validation";
import type { AuditService } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createTaskRoutes(
  db: NodePgDatabase,
  auditService: AuditService,
) {
  const router = Router();
  const taskService = new TaskService(db, auditService);

  // GET /api/tasks
  router.get("/", async (req, res, next) => {
    try {
      const filters = {
        projectId: req.query.projectId
          ? parseInt(req.query.projectId as string, 10)
          : undefined,
        status: req.query.status as string | undefined,
        priority: req.query.priority as string | undefined,
        assignedTo: req.query.assignedTo
          ? parseInt(req.query.assignedTo as string, 10)
          : undefined,
        search: req.query.search as string | undefined,
        sort: req.query.sort as string | undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string, 10)
          : undefined,
        offset: req.query.offset
          ? parseInt(req.query.offset as string, 10)
          : undefined,
      };

      const result = await taskService.list(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/tasks/stats
  router.get("/stats", async (req, res, next) => {
    try {
      const projectId = req.query.projectId
        ? parseInt(req.query.projectId as string, 10)
        : undefined;
      const stats = await taskService.getStats(projectId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/tasks/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await taskService.getById(id);
      if (!result) {
        return res.status(404).json({
          error: "Not Found",
          message: `Task ${id} not found`,
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/tasks
  router.post(
    "/",
    validateBody(insertTaskSchema),
    async (req, res, next) => {
      try {
        const task = await taskService.create(req.body);
        res.status(201).json({ task });
      } catch (err) {
        next(err);
      }
    },
  );

  // PATCH /api/tasks/:id
  router.patch(
    "/:id",
    validateBody(updateTaskSchema),
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id, 10);
        const task = await taskService.update(id, req.body);
        if (!task) {
          return res.status(404).json({
            error: "Not Found",
            message: `Task ${id} not found`,
          });
        }
        res.json({ task });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/tasks/:id
  router.delete("/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await taskService.delete(id);
      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: `Task ${id} not found`,
        });
      }
      res.json({ success: true, deleted: { id: deleted.id, title: deleted.title } });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/tasks/reorder
  router.put(
    "/reorder",
    validateBody(reorderTasksSchema),
    async (req, res, next) => {
      try {
        const { taskIds, status } = req.body;
        await taskService.reorder(taskIds, status);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/tasks/:id/notes
  router.post(
    "/:id/notes",
    validateBody(insertTaskNoteSchema),
    async (req, res, next) => {
      try {
        const taskId = parseInt(req.params.id, 10);
        const note = await taskService.addNote(taskId, req.body.content);
        res.status(201).json({ note });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/tasks/:id/notes/:noteId
  router.delete("/:id/notes/:noteId", async (req, res, next) => {
    try {
      const noteId = parseInt(req.params.noteId, 10);
      const deleted = await taskService.deleteNote(noteId);
      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: `Note ${noteId} not found`,
        });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/tasks/:id/highlights
  router.post(
    "/:id/highlights",
    validateBody(insertTaskHighlightSchema),
    async (req, res, next) => {
      try {
        const taskId = parseInt(req.params.id, 10);
        const highlight = await taskService.addHighlight(taskId, req.body);
        res.status(201).json({ highlight });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

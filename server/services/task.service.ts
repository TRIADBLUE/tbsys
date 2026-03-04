import { eq, desc, asc, and, SQL, ilike, isNull } from "drizzle-orm";
import { tasks, taskNotes, taskHighlights } from "../../shared/schema";
import type { AuditService } from "./audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export class TaskService {
  constructor(
    private db: NodePgDatabase,
    private auditService: AuditService,
  ) {}

  async list(filters: {
    projectId?: number;
    status?: string;
    priority?: string;
    assignedTo?: number;
    search?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: SQL[] = [];

    if (filters.projectId) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }
    if (filters.status) {
      conditions.push(eq(tasks.status, filters.status as any));
    }
    if (filters.priority) {
      conditions.push(eq(tasks.priority, filters.priority as any));
    }
    if (filters.assignedTo) {
      conditions.push(eq(tasks.assignedTo, filters.assignedTo));
    }
    if (filters.search) {
      conditions.push(ilike(tasks.title, `%${filters.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy;
    if (filters.sort === "due_date") {
      orderBy = [asc(tasks.dueDate), desc(tasks.createdAt)];
    } else if (filters.sort === "priority") {
      orderBy = [desc(tasks.priority), desc(tasks.createdAt)];
    } else if (filters.sort === "created") {
      orderBy = [desc(tasks.createdAt)];
    } else {
      orderBy = [asc(tasks.displayOrder), desc(tasks.createdAt)];
    }

    const rows = await this.db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(...orderBy)
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

    const allMatching = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(where);

    return { tasks: rows, total: allMatching.length };
  }

  async getById(id: number) {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!task) return null;

    const notes = await this.db
      .select()
      .from(taskNotes)
      .where(eq(taskNotes.taskId, id))
      .orderBy(desc(taskNotes.createdAt));

    const highlights = await this.db
      .select()
      .from(taskHighlights)
      .where(eq(taskHighlights.taskId, id))
      .orderBy(desc(taskHighlights.createdAt));

    return { task, notes, highlights };
  }

  async create(data: {
    projectId?: number | null;
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    assignedTo?: number | null;
    parentTaskId?: number | null;
    displayOrder?: number;
    tags?: string[];
    dueDate?: string | null;
  }) {
    const [task] = await this.db
      .insert(tasks)
      .values({
        ...data,
        status: (data.status as any) || "todo",
        priority: (data.priority as any) || "medium",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      })
      .returning();

    await this.auditService.log({
      action: "create",
      entityType: "task",
      entityId: task.id,
      newValue: task,
    });

    return task;
  }

  async update(
    id: number,
    data: Record<string, unknown>,
  ) {
    const [existing] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existing) return null;

    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

    // Handle dueDate string -> Date conversion
    if ("dueDate" in updateData) {
      updateData.dueDate = updateData.dueDate
        ? new Date(updateData.dueDate as string)
        : null;
    }

    // Auto-set completedAt when status changes to done
    if (updateData.status === "done" && existing.status !== "done") {
      updateData.completedAt = new Date();
    } else if (updateData.status && updateData.status !== "done") {
      updateData.completedAt = null;
    }

    const [updated] = await this.db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    await this.auditService.log({
      action: "update",
      entityType: "task",
      entityId: id,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async delete(id: number) {
    const [existing] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existing) return null;

    await this.db.delete(tasks).where(eq(tasks.id, id));

    await this.auditService.log({
      action: "delete",
      entityType: "task",
      entityId: id,
      previousValue: existing,
    });

    return existing;
  }

  async reorder(taskIds: number[], status: string) {
    for (let i = 0; i < taskIds.length; i++) {
      await this.db
        .update(tasks)
        .set({ displayOrder: i, updatedAt: new Date() })
        .where(eq(tasks.id, taskIds[i]));
    }

    await this.auditService.log({
      action: "reorder",
      entityType: "task",
      newValue: { taskIds, status },
    });
  }

  async getStats(projectId?: number) {
    const conditions: SQL[] = [];
    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const allTasks = await this.db
      .select()
      .from(tasks)
      .where(where);

    const byStatus: Record<string, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    let overdue = 0;
    const now = new Date();

    for (const task of allTasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
      if (
        task.dueDate &&
        task.dueDate < now &&
        task.status !== "done"
      ) {
        overdue++;
      }
    }

    return { byStatus, byPriority, total: allTasks.length, overdue };
  }

  async addNote(taskId: number, content: string, createdBy?: number | null) {
    const [note] = await this.db
      .insert(taskNotes)
      .values({ taskId, content, createdBy: createdBy ?? null })
      .returning();
    return note;
  }

  async deleteNote(noteId: number) {
    const [existing] = await this.db
      .select()
      .from(taskNotes)
      .where(eq(taskNotes.id, noteId))
      .limit(1);

    if (!existing) return null;

    await this.db.delete(taskNotes).where(eq(taskNotes.id, noteId));
    return existing;
  }

  async addHighlight(
    taskId: number,
    data: {
      sourceType: string;
      sourcePath?: string | null;
      highlightedText: string;
      contextSnippet?: string | null;
    },
    createdBy?: number | null,
  ) {
    const [highlight] = await this.db
      .insert(taskHighlights)
      .values({
        taskId,
        sourceType: data.sourceType as any,
        sourcePath: data.sourcePath ?? null,
        highlightedText: data.highlightedText,
        contextSnippet: data.contextSnippet ?? null,
        createdBy: createdBy ?? null,
      })
      .returning();
    return highlight;
  }
}

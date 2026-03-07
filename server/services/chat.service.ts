import { eq, desc, and, SQL } from "drizzle-orm";
import {
  chatThreads,
  chatMessages,
  aiProviderConfigs,
  projects,
} from "../../shared/schema";
import type { AuditService } from "./audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export class ChatService {
  constructor(
    private db: NodePgDatabase,
    private auditService: AuditService,
  ) {}

  async listThreads(filters: {
    projectId?: number;
    agentRole?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: SQL[] = [];

    if (filters.projectId) {
      conditions.push(eq(chatThreads.projectId, filters.projectId));
    }
    if (filters.agentRole) {
      conditions.push(eq(chatThreads.agentRole, filters.agentRole as any));
    }
    if (filters.status) {
      conditions.push(eq(chatThreads.status, filters.status as any));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const threads = await this.db
      .select()
      .from(chatThreads)
      .where(where)
      .orderBy(desc(chatThreads.updatedAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    const all = await this.db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(where);

    return { threads, total: all.length };
  }

  async getThread(id: number) {
    const [thread] = await this.db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.id, id))
      .limit(1);

    if (!thread) return null;

    const messages = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, id))
      .orderBy(chatMessages.createdAt);

    return { thread, messages };
  }

  async createThread(data: {
    projectId?: number | null;
    title: string;
    agentRole?: string;
    providerSlug?: string;
    modelId?: string;
  }) {
    const [thread] = await this.db
      .insert(chatThreads)
      .values({
        projectId: data.projectId ?? null,
        title: data.title,
        agentRole: (data.agentRole as any) || "builder",
        providerSlug: data.providerSlug || null,
        modelId: data.modelId || null,
      })
      .returning();

    await this.auditService.log({
      action: "create",
      entityType: "chat_thread",
      entityId: thread.id,
      newValue: thread,
    });

    return thread;
  }

  async archiveThread(id: number) {
    const [thread] = await this.db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.id, id))
      .limit(1);

    if (!thread) return null;

    const [updated] = await this.db
      .update(chatThreads)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(chatThreads.id, id))
      .returning();

    return updated;
  }

  async addMessage(
    threadId: number,
    data: { content: string; role?: string; attachments?: any[] },
  ) {
    const metadata: Record<string, unknown> = {};
    if (data.attachments?.length) {
      metadata.attachments = data.attachments;
    }

    const [message] = await this.db
      .insert(chatMessages)
      .values({
        threadId,
        role: (data.role as any) || "user",
        content: data.content,
        metadata,
      })
      .returning();

    // Update thread's updatedAt
    await this.db
      .update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(eq(chatThreads.id, threadId));

    return message;
  }

  async linkMessageToTask(messageId: number, taskId: number | null) {
    const [updated] = await this.db
      .update(chatMessages)
      .set({ linkedTaskId: taskId })
      .where(eq(chatMessages.id, messageId))
      .returning();

    return updated || null;
  }

  async getProviders() {
    const providers = await this.db
      .select()
      .from(aiProviderConfigs)
      .orderBy(aiProviderConfigs.displayOrder);

    return providers;
  }

  async getProviderConfig(slug: string) {
    const [config] = await this.db
      .select()
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.slug, slug))
      .limit(1);

    return config || null;
  }

  async getConversationHistory(threadId: number) {
    const messages = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(chatMessages.createdAt);

    return messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      attachments: (m.metadata as any)?.attachments || undefined,
    }));
  }

  async getProjectForThread(threadId: number) {
    const [thread] = await this.db
      .select({ projectId: chatThreads.projectId })
      .from(chatThreads)
      .where(eq(chatThreads.id, threadId))
      .limit(1);

    if (!thread?.projectId) return null;

    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, thread.projectId))
      .limit(1);

    return project || null;
  }

  async updateProvider(slug: string, data: Record<string, unknown>) {
    const [existing] = await this.db
      .select()
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.slug, slug))
      .limit(1);

    if (!existing) return null;

    const [updated] = await this.db
      .update(aiProviderConfigs)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(aiProviderConfigs.slug, slug))
      .returning();

    return updated;
  }
}

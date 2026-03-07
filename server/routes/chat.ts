import { Router } from "express";
import { ChatService } from "../services/chat.service";
import {
  createChatThreadSchema,
  sendChatMessageSchema,
  updateProviderConfigSchema,
} from "../../shared/validators";
import { validateBody } from "../middleware/validation";
import type { AuditService } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getProvider, getDefaultModel } from "../services/ai/provider-registry";
import { buildSystemPrompt } from "../services/ai/system-prompts";
import type { AIProviderType } from "../../shared/types";

export function createChatRoutes(
  db: NodePgDatabase,
  auditService: AuditService,
) {
  const router = Router();
  const chatService = new ChatService(db, auditService);

  // GET /api/chat/threads
  router.get("/threads", async (req, res, next) => {
    try {
      const filters = {
        projectId: req.query.projectId
          ? parseInt(req.query.projectId as string, 10)
          : undefined,
        agentRole: req.query.agentRole as string | undefined,
        status: (req.query.status as string) || "active",
        limit: req.query.limit
          ? parseInt(req.query.limit as string, 10)
          : undefined,
        offset: req.query.offset
          ? parseInt(req.query.offset as string, 10)
          : undefined,
      };
      const result = await chatService.listThreads(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/chat/threads
  router.post(
    "/threads",
    validateBody(createChatThreadSchema),
    async (req, res, next) => {
      try {
        const thread = await chatService.createThread(req.body);
        res.status(201).json({ thread });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/chat/threads/:id
  router.get("/threads/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await chatService.getThread(id);
      if (!result) {
        return res.status(404).json({ error: "Not Found", message: "Thread not found" });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/chat/threads/:id
  router.delete("/threads/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const thread = await chatService.archiveThread(id);
      if (!thread) {
        return res.status(404).json({ error: "Not Found", message: "Thread not found" });
      }
      res.json({ thread });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/chat/threads/:id/messages
  router.post(
    "/threads/:id/messages",
    validateBody(sendChatMessageSchema),
    async (req, res, next) => {
      try {
        const threadId = parseInt(req.params.id, 10);

        // Store the user message
        const userMessage = await chatService.addMessage(threadId, req.body);

        // Look up thread to get provider config
        const threadData = await chatService.getThread(threadId);
        if (!threadData) {
          return res.status(404).json({ error: "Not Found", message: "Thread not found" });
        }

        const { thread } = threadData;
        const providerSlug = thread.providerSlug;

        // If no provider configured, return just the stored message
        if (!providerSlug) {
          return res.status(201).json({ message: userMessage });
        }

        // Get provider config from DB
        const providerConfig = await chatService.getProviderConfig(providerSlug);
        if (!providerConfig || !providerConfig.isEnabled) {
          return res.status(201).json({ message: userMessage });
        }

        // Resolve model: thread modelId > provider modelTiers for agentRole > default
        const agentRole = thread.agentRole as "builder" | "architect";
        const tiers = (providerConfig.modelTiers || {}) as { builder?: string; architect?: string };
        const model =
          thread.modelId ||
          tiers[agentRole] ||
          getDefaultModel(providerConfig.providerType as AIProviderType);

        // Get conversation history (includes the user message we just added)
        const history = await chatService.getConversationHistory(threadId);

        // Build role-specific system prompt with project context
        const project = thread.projectId
          ? await chatService.getProjectForThread(threadId)
          : null;
        const systemPrompt = await buildSystemPrompt(agentRole, project);

        // Set SSE headers
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });

        let fullResponse = "";

        try {
          const provider = getProvider(providerConfig.providerType as AIProviderType);

          for await (const chunk of provider.chat(history, { model, systemPrompt })) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
          }

          // Store the complete assistant message
          const assistantMessage = await chatService.addMessage(threadId, {
            content: fullResponse,
            role: "assistant",
          });

          res.write(`data: ${JSON.stringify({ type: "done", message: assistantMessage })}\n\n`);
        } catch (streamError: any) {
          const errorMsg = streamError?.message || "AI provider error";
          res.write(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`);
        }

        res.write("data: [DONE]\n\n");
        res.end();
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/chat/threads/:id/link-task
  router.post("/threads/:id/link-task", async (req, res, next) => {
    try {
      const { messageId, taskId } = req.body;
      const updated = await chatService.linkMessageToTask(messageId, taskId);
      if (!updated) {
        return res.status(404).json({ error: "Not Found", message: "Message not found" });
      }
      res.json({ message: updated });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/chat/providers
  router.get("/providers", async (_req, res, next) => {
    try {
      const providers = await chatService.getProviders();
      res.json({ providers });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/chat/providers/:slug
  router.patch(
    "/providers/:slug",
    validateBody(updateProviderConfigSchema),
    async (req, res, next) => {
      try {
        const provider = await chatService.updateProvider(
          req.params.slug,
          req.body,
        );
        if (!provider) {
          return res.status(404).json({ error: "Not Found", message: "Provider not found" });
        }
        res.json({ provider });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

import { useState, useCallback, useRef } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ChatThread,
  ChatMessage,
  ChatThreadListResponse,
  ChatThreadDetailResponse,
  ChatProviderListResponse,
  AIProviderConfig,
} from "@shared/types";
import type { CreateChatThread } from "@shared/validators";

export function useChatThreads(filters?: {
  projectId?: number;
  agentRole?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["chat-threads", filters],
    queryFn: () =>
      apiClient.get<ChatThreadListResponse>("/chat/threads", filters as any),
  });
}

export function useChatThread(id: number | null) {
  return useQuery({
    queryKey: ["chat-threads", id],
    queryFn: () =>
      apiClient.get<ChatThreadDetailResponse>(`/chat/threads/${id}`),
    enabled: !!id,
  });
}

export function useCreateChatThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChatThread) =>
      apiClient.post<{ thread: ChatThread }>("/chat/threads", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    },
  });
}

export function useArchiveChatThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete<{ thread: ChatThread }>(`/chat/threads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    },
  });
}

export function useStreamMessage() {
  const queryClient = useQueryClient();
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (threadId: number, content: string, attachments?: { filename: string; mimeType: string; base64: string }[]) => {
      setStreamingContent("");
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const body: Record<string, unknown> = { content };
        if (attachments?.length) {
          body.attachments = attachments;
        }

        const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        // Non-SSE response (provider not configured) — parse as JSON
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          await res.json();
          queryClient.invalidateQueries({
            queryKey: ["chat-threads", threadId],
          });
          queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
          setIsStreaming(false);
          return;
        }

        // SSE response — read stream
        const reader = res.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "chunk") {
                accumulated += parsed.content;
                setStreamingContent(accumulated);
              } else if (parsed.type === "error") {
                setError(parsed.error);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Invalidate to get the final DB state
        queryClient.invalidateQueries({
          queryKey: ["chat-threads", threadId],
        });
        queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to send message");
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [queryClient],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, streamingContent, isStreaming, error, abort };
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      content,
    }: {
      threadId: number;
      content: string;
    }) =>
      apiClient.post<{ message: ChatMessage }>(
        `/chat/threads/${threadId}/messages`,
        { content },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["chat-threads", variables.threadId],
      });
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    },
  });
}

export function useChatProviders() {
  return useQuery({
    queryKey: ["chat-providers"],
    queryFn: () =>
      apiClient.get<ChatProviderListResponse>("/chat/providers"),
  });
}

export function useUpdateChatProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      data,
    }: {
      slug: string;
      data: Record<string, unknown>;
    }) =>
      apiClient.patch<{ provider: AIProviderConfig }>(
        `/chat/providers/${slug}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-providers"] });
    },
  });
}

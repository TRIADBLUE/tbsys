export interface ChatAttachment {
  filename: string;
  mimeType: string;
  url?: string;
  base64?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: ChatAttachment[];
}

export interface StreamOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export abstract class AIProvider {
  abstract chat(
    messages: ChatMessage[],
    options: StreamOptions,
  ): AsyncGenerator<string>;

  protected formatMessages(
    dbMessages: { role: string; content: string }[],
  ): ChatMessage[] {
    return dbMessages.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));
  }
}

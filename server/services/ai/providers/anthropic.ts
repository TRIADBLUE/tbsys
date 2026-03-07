import Anthropic from "@anthropic-ai/sdk";
import { AIProvider, type ChatMessage, type StreamOptions } from "../base-provider";

export class AnthropicProvider extends AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async *chat(messages: ChatMessage[], options: StreamOptions): AsyncGenerator<string> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const formattedMessages = nonSystemMessages.map((m) => {
      // If message has image attachments, build multimodal content
      const imageAttachments = m.attachments?.filter((a) =>
        a.mimeType.startsWith("image/"),
      );

      if (imageAttachments?.length && m.role === "user") {
        const content: Anthropic.ContentBlockParam[] = [];

        for (const att of imageAttachments) {
          if (att.base64) {
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: att.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: att.base64,
              },
            });
          }
        }

        // Add non-image attachments as text
        const docAttachments = m.attachments?.filter(
          (a) => !a.mimeType.startsWith("image/"),
        );
        if (docAttachments?.length) {
          const docText = docAttachments
            .map((a) => `[Attached file: ${a.filename}]\n${a.base64 ? Buffer.from(a.base64, "base64").toString("utf-8") : ""}`)
            .join("\n\n");
          content.push({ type: "text", text: docText });
        }

        content.push({ type: "text", text: m.content });

        return {
          role: m.role as "user" | "assistant",
          content,
        };
      }

      // Plain text message
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    });

    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt || systemMessages.map((m) => m.content).join("\n") || undefined,
      messages: formattedMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}

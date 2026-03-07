import OpenAI from "openai";
import { AIProvider, type ChatMessage, type StreamOptions } from "../base-provider";

export class OpenAIProvider extends AIProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    super();
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async *chat(messages: ChatMessage[], options: StreamOptions): AsyncGenerator<string> {
    const formattedMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      formattedMessages.push({ role: "system", content: options.systemPrompt });
    }

    for (const m of messages) {
      const imageAttachments = m.attachments?.filter((a) =>
        a.mimeType.startsWith("image/"),
      );

      if (imageAttachments?.length && m.role === "user") {
        const content: OpenAI.ChatCompletionContentPart[] = [];

        for (const att of imageAttachments) {
          if (att.base64) {
            content.push({
              type: "image_url",
              image_url: {
                url: `data:${att.mimeType};base64,${att.base64}`,
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

        formattedMessages.push({ role: "user", content });
      } else {
        formattedMessages.push({
          role: m.role,
          content: m.content,
        } as OpenAI.ChatCompletionMessageParam);
      }
    }

    const stream = await this.client.chat.completions.create({
      model: options.model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      messages: formattedMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}

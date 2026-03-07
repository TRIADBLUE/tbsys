import type { AIProvider } from "./base-provider";
import type { AIProviderType } from "../../../shared/types";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import { GoogleProvider } from "./providers/google";
import { DeepSeekProvider } from "./providers/deepseek";
import { GroqProvider } from "./providers/groq";
import { KimiProvider } from "./providers/kimi";

const ENV_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  groq: "GROQ_API_KEY",
  kimi: "KIMI_API_KEY",
};

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  deepseek: "deepseek-chat",
  groq: "llama-3.3-70b-versatile",
  kimi: "moonshot-v1-8k",
};

export function getProvider(providerType: AIProviderType): AIProvider {
  const envKey = ENV_KEYS[providerType];
  const apiKey = envKey ? process.env[envKey] : undefined;

  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${providerType} (env: ${envKey})`);
  }

  switch (providerType) {
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "openai":
      return new OpenAIProvider(apiKey);
    case "google":
      return new GoogleProvider(apiKey);
    case "deepseek":
      return new DeepSeekProvider(apiKey);
    case "groq":
      return new GroqProvider(apiKey);
    case "kimi":
      return new KimiProvider(apiKey);
    default:
      throw new Error(`Unsupported provider type: ${providerType}`);
  }
}

export function getDefaultModel(providerType: AIProviderType): string {
  return DEFAULT_MODELS[providerType] || "gpt-4o";
}

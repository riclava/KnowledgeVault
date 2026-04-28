export type AiProvider = "mock" | "deepseek" | "kimi" | "custom";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiConfig = {
  provider: AiProvider;
  baseUrl: string | null;
  model: string;
  apiKey: string | null;
};

export type AiEnv = Partial<
  Record<"AI_PROVIDER" | "AI_API_KEY" | "AI_BASE_URL" | "AI_MODEL", string | undefined>
>;

type ChatOptions = {
  env?: AiEnv;
  fetcher?: typeof fetch;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  mockText?: string;
};

export function resolveAiConfig(env?: AiEnv): AiConfig {
  const currentEnv = env ?? readAiEnv();
  const provider = normalizeProvider(currentEnv.AI_PROVIDER);

  if (provider === "mock") {
    return {
      provider,
      baseUrl: null,
      model: "mock",
      apiKey: null,
    };
  }

  if (provider === "deepseek") {
    return {
      provider,
      baseUrl: normalizeBaseUrl(currentEnv.AI_BASE_URL ?? "https://api.deepseek.com"),
      model: textOrDefault(currentEnv.AI_MODEL, "deepseek-chat"),
      apiKey: textOrNull(currentEnv.AI_API_KEY),
    };
  }

  if (provider === "kimi") {
    return {
      provider,
      baseUrl: normalizeBaseUrl(currentEnv.AI_BASE_URL ?? "https://api.moonshot.ai/v1"),
      model: textOrDefault(currentEnv.AI_MODEL, "kimi-k2-0905"),
      apiKey: textOrNull(currentEnv.AI_API_KEY),
    };
  }

  return {
    provider,
    baseUrl: normalizeBaseUrl(currentEnv.AI_BASE_URL ?? ""),
    model: textOrDefault(currentEnv.AI_MODEL, ""),
    apiKey: textOrNull(currentEnv.AI_API_KEY),
  };
}

export async function chatText({
  env,
  fetcher = fetch,
  messages,
  temperature = 0.2,
  maxTokens,
  mockText,
}: ChatOptions): Promise<string> {
  const config = resolveAiConfig(env);

  if (config.provider === "mock") {
    return (mockText ?? "").trim();
  }

  assertNetworkConfig(config);

  const response = await fetcher(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `AI chat completion failed (${response.status}): ${await response.text()}`,
    );
  }

  return extractAssistantText(await response.json());
}

export async function chatJson<T>(options: ChatOptions): Promise<T> {
  const text = await chatText(options);
  const jsonText = extractJsonText(text);

  return JSON.parse(jsonText) as T;
}

export function extractAssistantText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response payload is not an object.");
  }

  const choices = (payload as Record<string, unknown>).choices;

  if (!Array.isArray(choices)) {
    throw new Error("AI response did not include choices.");
  }

  for (const choice of choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }

    const message = (choice as Record<string, unknown>).message;

    if (!message || typeof message !== "object") {
      continue;
    }

    const content = (message as Record<string, unknown>).content;

    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
  }

  throw new Error("AI response did not include assistant text.");
}

export function extractJsonText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return (fenced?.[1] ?? trimmed).trim();
}

function assertNetworkConfig(config: AiConfig) {
  if (!config.apiKey) {
    throw new Error("AI_API_KEY is required when AI_PROVIDER uses a network provider.");
  }

  if (!config.baseUrl) {
    throw new Error("AI_BASE_URL is required when AI_PROVIDER=custom.");
  }

  if (!config.model) {
    throw new Error("AI_MODEL is required when AI_PROVIDER=custom.");
  }
}

function normalizeProvider(value: string | undefined): AiProvider {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "deepseek" ||
    normalized === "kimi" ||
    normalized === "custom"
  ) {
    return normalized;
  }

  return "mock";
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function textOrDefault(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function textOrNull(value: string | undefined) {
  return value?.trim() || null;
}

function readAiEnv(): AiEnv {
  return {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_BASE_URL: process.env.AI_BASE_URL,
    AI_MODEL: process.env.AI_MODEL,
  };
}

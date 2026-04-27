export type OpenAiCompatibleProvider = "kimi" | "deepseek" | "custom";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOptions = {
  messages: ChatMessage[];
  responseFormat?: {
    type: "text" | "json_object";
  };
  maxCompletionTokens?: number;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type ProviderConfig = {
  baseUrl: string;
  model: string;
};

const PROVIDER_DEFAULTS = {
  kimi: {
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  custom: {
    baseUrl: "",
    model: "",
  },
} satisfies Record<OpenAiCompatibleProvider, ProviderConfig>;

export async function createChatCompletion(
  options: ChatCompletionOptions,
): Promise<string> {
  const config = resolveClientConfig();
  const response = await fetchChatCompletion({
    config,
    body: {
      model: config.model,
      messages: options.messages,
      ...(options.responseFormat
        ? { response_format: options.responseFormat }
        : {}),
      ...(options.maxCompletionTokens
        ? { max_completion_tokens: options.maxCompletionTokens }
        : {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | ChatCompletionResponse
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ??
        `${config.provider} chat completion request failed`,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`${config.provider} returned an empty chat completion`);
  }

  return content;
}

function resolveClientConfig() {
  const provider = resolveProvider();
  const defaults = PROVIDER_DEFAULTS[provider];
  const apiKey = resolveApiKey(provider);
  const baseUrl = normalizeBaseUrl(
    resolveEnvValue(provider, "API_BASE_URL") ?? defaults.baseUrl,
  );
  const model = resolveEnvValue(provider, "MODEL") ?? defaults.model;
  const timeoutMs = clampInteger(
    Number(
      process.env.LLM_API_TIMEOUT_MS ??
        resolveEnvValue(provider, "API_TIMEOUT_MS") ??
        25000,
    ),
    1000,
    120000,
  );

  if (!apiKey) {
    throw new Error(`API key is not configured for ${provider}`);
  }

  if (!baseUrl) {
    throw new Error(`API base URL is not configured for ${provider}`);
  }

  if (!model) {
    throw new Error(`Model is not configured for ${provider}`);
  }

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    timeoutMs,
  };
}

function resolveProvider(): OpenAiCompatibleProvider {
  const value = process.env.LLM_PROVIDER?.trim().toLowerCase();

  if (value === "kimi" || value === "deepseek" || value === "custom") {
    return value;
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return "deepseek";
  }

  return "kimi";
}

function resolveApiKey(provider: OpenAiCompatibleProvider) {
  return (
    process.env.LLM_API_KEY ??
    resolveEnvValue(provider, "API_KEY") ??
    process.env.MOONSHOT_API_KEY
  );
}

function resolveEnvValue(
  provider: OpenAiCompatibleProvider,
  name: "API_KEY" | "API_BASE_URL" | "API_TIMEOUT_MS" | "MODEL",
) {
  const prefix = provider === "kimi" ? "KIMI" : provider.toUpperCase();
  return process.env[`LLM_${name}`] ?? process.env[`${prefix}_${name}`];
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

async function fetchChatCompletion({
  config,
  body,
}: {
  config: ReturnType<typeof resolveClientConfig>;
  body: Record<string, unknown>;
}) {
  try {
    return await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["AbortError", "TimeoutError"].includes(error.name)
    ) {
      throw new Error(`${config.provider} request timed out`);
    }

    throw error;
  }
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

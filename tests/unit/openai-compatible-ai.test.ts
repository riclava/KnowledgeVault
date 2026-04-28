import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chatJson,
  chatText,
  resolveAiConfig,
} from "@/server/ai/openai-compatible";

describe("OpenAI-compatible AI client", () => {
  it("resolves provider defaults for mock, DeepSeek, Kimi, and custom", () => {
    assert.deepEqual(resolveAiConfig({ AI_PROVIDER: "mock" }), {
      provider: "mock",
      baseUrl: null,
      model: "mock",
      apiKey: null,
    });
    assert.deepEqual(resolveAiConfig({ AI_PROVIDER: "deepseek", AI_API_KEY: "deepseek-key" }), {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "deepseek-key",
    });
    assert.deepEqual(
      resolveAiConfig({
        AI_PROVIDER: "kimi",
        AI_API_KEY: "kimi-key",
        AI_MODEL: "kimi-k2-0905",
      }),
      {
        provider: "kimi",
        baseUrl: "https://api.moonshot.ai/v1",
        model: "kimi-k2-0905",
        apiKey: "kimi-key",
      },
    );
    assert.deepEqual(
      resolveAiConfig({
        AI_PROVIDER: "custom",
        AI_API_KEY: "custom-key",
        AI_BASE_URL: "https://llm.example.test/v1/",
        AI_MODEL: "custom-model",
      }),
      {
        provider: "custom",
        baseUrl: "https://llm.example.test/v1",
        model: "custom-model",
        apiKey: "custom-key",
      },
    );
  });

  it("requires API keys and model/base URL values before making network requests", async () => {
    await assert.rejects(
      chatText({
        env: { AI_PROVIDER: "deepseek" },
        messages: [{ role: "user", content: "hello" }],
      }),
      /AI_API_KEY is required/,
    );

    await assert.rejects(
      chatText({
        env: {
          AI_PROVIDER: "custom",
          AI_API_KEY: "key",
          AI_BASE_URL: "https://llm.example.test/v1",
        },
        messages: [{ role: "user", content: "hello" }],
      }),
      /AI_MODEL is required/,
    );
  });

  it("calls chat completions and extracts assistant text", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "  hello from model  ",
              },
            },
          ],
        }),
        { status: 200 },
      );
    };

    const text = await chatText({
      env: {
        AI_PROVIDER: "deepseek",
        AI_API_KEY: "deepseek-key",
        AI_MODEL: "deepseek-chat",
      },
      fetcher,
      messages: [
        { role: "system", content: "You are concise." },
        { role: "user", content: "Say hello." },
      ],
    });

    assert.equal(text, "hello from model");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.deepseek.com/chat/completions");
    assert.equal(requests[0].init.method, "POST");
    assert.equal(
      (requests[0].init.headers as Record<string, string>).Authorization,
      "Bearer deepseek-key",
    );

    const body = JSON.parse(String(requests[0].init.body));
    assert.equal(body.model, "deepseek-chat");
    assert.deepEqual(body.messages, [
      { role: "system", content: "You are concise." },
      { role: "user", content: "Say hello." },
    ]);
    assert.equal(body.temperature, 0.2);
  });

  it("parses JSON from plain assistant text or fenced blocks", async () => {
    const plain = await chatJson<{ ok: boolean }>({
      env: { AI_PROVIDER: "mock" },
      mockText: "{\"ok\":true}",
      messages: [{ role: "user", content: "json" }],
    });
    const fenced = await chatJson<{ ok: boolean }>({
      env: { AI_PROVIDER: "mock" },
      mockText: "```json\n{\"ok\":true}\n```",
      messages: [{ role: "user", content: "json" }],
    });

    assert.deepEqual(plain, { ok: true });
    assert.deepEqual(fenced, { ok: true });
  });
});

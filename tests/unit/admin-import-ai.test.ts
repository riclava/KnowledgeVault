import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAdminImportJsonSchema,
  generateAdminImportBatch,
  generateMockAdminImportBatch,
} from "@/server/admin/admin-import-ai";

describe("admin import AI provider", () => {
  it("creates a strict structured output schema", () => {
    const schema = createAdminImportJsonSchema();
    const itemSchema = schema.schema.$defs?.item;
    const contentTypeSchema = itemSchema?.properties?.contentType;
    const renderPayloadSchema = itemSchema?.properties?.renderPayload;

    assert.equal(schema.type, "json_schema");
    assert.equal(schema.strict, true);
    assert.equal(schema.schema.additionalProperties, false);
    assert.deepEqual(schema.schema.required, ["sourceTitle", "defaultDomain", "items", "relations"]);
    assert.deepEqual(contentTypeSchema?.enum, [
      "math_formula",
      "vocabulary",
      "plain_text",
      "concept_card",
      "comparison_table",
      "procedure",
    ]);
    assert.ok(schema.schema.$defs?.conceptCardPayload);
    assert.ok(schema.schema.$defs?.comparisonTablePayload);
    assert.ok(schema.schema.$defs?.procedurePayload);
    assert.deepEqual(schema.schema.$defs?.procedurePayload.required, [
      "steps",
      "pitfalls",
    ]);
    assert.equal(schema.schema.$defs?.procedurePayload.properties?.mode, undefined);
    assert.equal(schema.schema.$defs?.procedurePayload.properties?.nodes, undefined);
    assert.equal(schema.schema.$defs?.comparisonTablePayload.properties?.mode, undefined);
    assert.deepEqual(
      renderPayloadSchema?.anyOf?.map((entry) => entry.$ref),
      [
        "#/$defs/mathFormulaPayload",
        "#/$defs/vocabularyPayload",
        "#/$defs/plainTextPayload",
        "#/$defs/conceptCardPayload",
        "#/$defs/comparisonTablePayload",
        "#/$defs/procedurePayload",
      ],
    );
  });

  it("keeps object schemas strict and schema references bare", () => {
    const schema = createAdminImportJsonSchema();

    assertStrictObjectSchemas(schema.schema);
  });

  it("generates a deterministic mock batch for tests and local UI", async () => {
    const batch = await generateMockAdminImportBatch({
      sourceMaterial: "线性方程是一类最高次数为一的方程。",
      sourceTitle: "线性方程笔记",
      defaultDomain: "数学",
      defaultSubdomain: "代数",
    });

    assert.equal(batch.defaultDomain, "数学");
    assert.ok(batch.items.length >= 3);
    assert.equal(batch.items[0].slug, "mock-linear-equation");
    assert.equal(batch.items[0].questions.length, 3);
    assert.equal(
      batch.items.some((item) => item.contentType === "concept_card"),
      true,
    );
    assert.equal(
      batch.items.some((item) => item.contentType === "comparison_table"),
      true,
    );
    assert.equal(
      batch.items.some((item) => item.contentType === "procedure"),
      true,
    );
  });

  it("rejects unsupported providers before using network", async () => {
    const originalProvider = process.env.ADMIN_IMPORT_PROVIDER;
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;

    process.env.ADMIN_IMPORT_PROVIDER = "local-llm";
    globalThis.fetch = (() => {
      fetchCalled = true;
      throw new Error("fetch should not be called");
    }) as typeof fetch;

    try {
      await assert.rejects(
        generateAdminImportBatch({
          sourceMaterial: "source",
          defaultDomain: "数学",
        }),
        /Unsupported ADMIN_IMPORT_PROVIDER: local-llm/,
      );
      assert.equal(fetchCalled, false);
    } finally {
      if (originalProvider === undefined) {
        delete process.env.ADMIN_IMPORT_PROVIDER;
      } else {
        process.env.ADMIN_IMPORT_PROVIDER = originalProvider;
      }

      globalThis.fetch = originalFetch;
    }
  });

  it("generates a batch through an OpenAI-compatible chat completion provider", async () => {
    const originalAdminProvider = process.env.ADMIN_IMPORT_PROVIDER;
    const originalAiProvider = process.env.AI_PROVIDER;
    const originalAiApiKey = process.env.AI_API_KEY;
    const originalAiModel = process.env.AI_MODEL;
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];

    process.env.ADMIN_IMPORT_PROVIDER = "ai";
    process.env.AI_PROVIDER = "deepseek";
    process.env.AI_API_KEY = "deepseek-key";
    process.env.AI_MODEL = "deepseek-chat";
    globalThis.fetch = (async (url, init) => {
      requests.push({
        url: String(url),
        body: JSON.parse(String(init?.body)),
      });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceTitle: "AI 笔记",
                  defaultDomain: "数学",
                  items: [],
                  relations: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const batch = await generateAdminImportBatch({
        sourceMaterial: "AI 生成知识项",
        sourceTitle: "AI 笔记",
        defaultDomain: "数学",
      });

      assert.equal(batch.sourceTitle, "AI 笔记");
      assert.equal(batch.defaultDomain, "数学");
      assert.deepEqual(batch.items, []);
      assert.deepEqual(batch.relations, []);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, "https://api.deepseek.com/chat/completions");
      assert.equal(requests[0].body.model, "deepseek-chat");
      assert.match(JSON.stringify(requests[0].body.messages), /AI 生成知识项/);
    } finally {
      restoreEnv("ADMIN_IMPORT_PROVIDER", originalAdminProvider);
      restoreEnv("AI_PROVIDER", originalAiProvider);
      restoreEnv("AI_API_KEY", originalAiApiKey);
      restoreEnv("AI_MODEL", originalAiModel);
      globalThis.fetch = originalFetch;
    }
  });

  it("asks the AI to infer missing metadata instead of requiring admin fields", async () => {
    const originalAdminProvider = process.env.ADMIN_IMPORT_PROVIDER;
    const originalAiProvider = process.env.AI_PROVIDER;
    const originalAiApiKey = process.env.AI_API_KEY;
    const originalAiModel = process.env.AI_MODEL;
    const originalFetch = globalThis.fetch;
    const requests: Array<{ body: Record<string, unknown> }> = [];

    process.env.ADMIN_IMPORT_PROVIDER = "ai";
    process.env.AI_PROVIDER = "deepseek";
    process.env.AI_API_KEY = "deepseek-key";
    process.env.AI_MODEL = "deepseek-chat";
    globalThis.fetch = (async (_url, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
      });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceTitle: "AI 推断标题",
                  defaultDomain: "数学",
                  items: [],
                  relations: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const batch = await generateAdminImportBatch({
        sourceMaterial: "讲解一次函数图像与斜率。",
      });

      assert.equal(batch.sourceTitle, "AI 推断标题");
      assert.equal(batch.defaultDomain, "数学");
      assert.equal(requests.length, 1);
      assert.match(
        JSON.stringify(requests[0].body.messages),
        /当管理员留空来源标题、默认领域或子领域时，请根据来源材料自行推断/,
      );
    } finally {
      restoreEnv("ADMIN_IMPORT_PROVIDER", originalAdminProvider);
      restoreEnv("AI_PROVIDER", originalAiProvider);
      restoreEnv("AI_API_KEY", originalAiApiKey);
      restoreEnv("AI_MODEL", originalAiModel);
      globalThis.fetch = originalFetch;
    }
  });

  it("asks the AI to keep procedure payloads to steps and pitfalls", async () => {
    const originalAdminProvider = process.env.ADMIN_IMPORT_PROVIDER;
    const originalAiProvider = process.env.AI_PROVIDER;
    const originalAiApiKey = process.env.AI_API_KEY;
    const originalAiModel = process.env.AI_MODEL;
    const originalFetch = globalThis.fetch;
    const requests: Array<{ body: Record<string, unknown> }> = [];

    process.env.ADMIN_IMPORT_PROVIDER = "ai";
    process.env.AI_PROVIDER = "deepseek";
    process.env.AI_API_KEY = "deepseek-key";
    process.env.AI_MODEL = "deepseek-chat";
    globalThis.fetch = (async (_url, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
      });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceTitle: "流程",
                  defaultDomain: "计算机科学",
                  items: [],
                  relations: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      await generateAdminImportBatch({
        sourceMaterial: "描述一个决策流程。",
      });

      assert.equal(requests.length, 1);
      assert.match(
        JSON.stringify(requests[0].body.messages),
        /只输出结构化 steps 和 pitfalls/,
      );
    } finally {
      restoreEnv("ADMIN_IMPORT_PROVIDER", originalAdminProvider);
      restoreEnv("AI_PROVIDER", originalAiProvider);
      restoreEnv("AI_API_KEY", originalAiApiKey);
      restoreEnv("AI_MODEL", originalAiModel);
      globalThis.fetch = originalFetch;
    }
  });

  it("guides the AI to choose content types and domains from the source material", async () => {
    const originalAdminProvider = process.env.ADMIN_IMPORT_PROVIDER;
    const originalAiProvider = process.env.AI_PROVIDER;
    const originalAiApiKey = process.env.AI_API_KEY;
    const originalAiModel = process.env.AI_MODEL;
    const originalFetch = globalThis.fetch;
    const requests: Array<{ body: Record<string, unknown> }> = [];

    process.env.ADMIN_IMPORT_PROVIDER = "ai";
    process.env.AI_PROVIDER = "deepseek";
    process.env.AI_API_KEY = "deepseek-key";
    process.env.AI_MODEL = "deepseek-chat";
    globalThis.fetch = (async (_url, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
      });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceTitle: "条件概率",
                  defaultDomain: "数学",
                  items: [],
                  relations: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      await generateAdminImportBatch({
        sourceMaterial: "条件概率、贝叶斯公式、全概率公式的适用场景对比。",
        defaultDomain: "learning",
        preferredContentTypes: ["plain_text"],
      });

      const messages = JSON.stringify(requests[0].body.messages);

      assert.match(messages, /所有提示词必须使用中文/);
      assert.match(messages, /主要内容必须使用中文/);
      assert.match(messages, /defaultDomain、domain 和 subdomain 必须使用中文/);
      assert.match(messages, /从来源材料中选择最具体的领域和子领域/);
      assert.match(messages, /数学\/概率/);
      assert.match(messages, /默认领域、默认子领域和偏好内容类型只是参考/);
      assert.match(messages, /根据知识形态为每个知识项选择唯一且最合适的 contentType/);
      assert.match(messages, /math_formula.*公式|公式.*math_formula/);
      assert.match(messages, /comparison_table.*对比|对比.*comparison_table/);
    } finally {
      restoreEnv("ADMIN_IMPORT_PROVIDER", originalAdminProvider);
      restoreEnv("AI_PROVIDER", originalAiProvider);
      restoreEnv("AI_API_KEY", originalAiApiKey);
      restoreEnv("AI_MODEL", originalAiModel);
      globalThis.fetch = originalFetch;
    }
  });

  it("lets admin import follow the global AI provider when no admin provider is set", async () => {
    const originalAdminProvider = process.env.ADMIN_IMPORT_PROVIDER;
    const originalAiProvider = process.env.AI_PROVIDER;
    const originalAiApiKey = process.env.AI_API_KEY;
    const originalAiModel = process.env.AI_MODEL;
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];

    delete process.env.ADMIN_IMPORT_PROVIDER;
    process.env.AI_PROVIDER = "deepseek";
    process.env.AI_API_KEY = "deepseek-key";
    process.env.AI_MODEL = "deepseek-chat";
    globalThis.fetch = (async (url) => {
      requests.push(String(url));

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceTitle: "AI 笔记",
                  defaultDomain: "数学",
                  items: [],
                  relations: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const batch = await generateAdminImportBatch({
        sourceMaterial: "AI 生成知识项",
        sourceTitle: "AI 笔记",
        defaultDomain: "数学",
      });

      assert.equal(batch.sourceTitle, "AI 笔记");
      assert.deepEqual(requests, ["https://api.deepseek.com/chat/completions"]);
    } finally {
      restoreEnv("ADMIN_IMPORT_PROVIDER", originalAdminProvider);
      restoreEnv("AI_PROVIDER", originalAiProvider);
      restoreEnv("AI_API_KEY", originalAiApiKey);
      restoreEnv("AI_MODEL", originalAiModel);
      globalThis.fetch = originalFetch;
    }
  });

  it("accepts DeepSeek and Kimi as direct admin import provider names", async () => {
    const originalAdminProvider = process.env.ADMIN_IMPORT_PROVIDER;
    const originalAiProvider = process.env.AI_PROVIDER;
    const originalAiApiKey = process.env.AI_API_KEY;
    const originalAiModel = process.env.AI_MODEL;
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];

    delete process.env.AI_PROVIDER;
    process.env.ADMIN_IMPORT_PROVIDER = "kimi";
    process.env.AI_API_KEY = "kimi-key";
    process.env.AI_MODEL = "kimi-k2-0905";
    globalThis.fetch = (async (url) => {
      requests.push(String(url));

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceTitle: "Kimi 笔记",
                  defaultDomain: "数学",
                  items: [],
                  relations: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const batch = await generateAdminImportBatch({
        sourceMaterial: "Kimi 生成知识项",
        sourceTitle: "Kimi 笔记",
        defaultDomain: "数学",
      });

      assert.equal(batch.sourceTitle, "Kimi 笔记");
      assert.deepEqual(requests, ["https://api.moonshot.ai/v1/chat/completions"]);
    } finally {
      restoreEnv("ADMIN_IMPORT_PROVIDER", originalAdminProvider);
      restoreEnv("AI_PROVIDER", originalAiProvider);
      restoreEnv("AI_API_KEY", originalAiApiKey);
      restoreEnv("AI_MODEL", originalAiModel);
      globalThis.fetch = originalFetch;
    }
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function assertStrictObjectSchemas(schema: unknown, path = "schema") {
  if (!schema || typeof schema !== "object") {
    return;
  }

  const record = schema as Record<string, unknown>;

  if ("$ref" in record) {
    assert.deepEqual(Object.keys(record), ["$ref"], `${path} should use a bare $ref`);
    return;
  }

  if (record.type === "object") {
    assert.equal(
      record.additionalProperties,
      false,
      `${path} must set additionalProperties: false`,
    );
  }

  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        assertStrictObjectSchemas(entry, `${path}.${key}.${index}`);
      });
      continue;
    }

    assertStrictObjectSchemas(value, `${path}.${key}`);
  }
}

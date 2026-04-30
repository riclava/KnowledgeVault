import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateAdminBulkGenerateImportItemBatch,
  generateMockAdminBulkGenerateImportItemBatch,
} from "@/server/admin/admin-bulk-generate-import-ai";

describe("admin bulk generate import AI", () => {
  it("generates deterministic one-item mock batches using forced metadata", async () => {
    const batch = await generateMockAdminBulkGenerateImportItemBatch({
      sourceText: "一次函数",
      contentType: "concept_card",
      domain: "数学",
      subdomain: "函数",
    });

    assert.equal(batch.defaultDomain, "数学");
    assert.equal(batch.items.length, 1);
    assert.equal(batch.relations.length, 0);
    assert.equal(batch.items[0].contentType, "concept_card");
    assert.equal(batch.items[0].domain, "数学");
    assert.equal(batch.items[0].subdomain, "函数");
    assert.match(batch.items[0].title, /一次函数/);
    assert.equal(batch.items[0].questions.length > 0, true);
  });

  it("asks the AI to generate exactly one item with the selected type and domain", async () => {
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
                  sourceTitle: "一次函数",
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
      await generateAdminBulkGenerateImportItemBatch({
        sourceText: "一次函数",
        contentType: "concept_card",
        domain: "数学",
        subdomain: "函数",
      });

      assert.equal(requests.length, 1);
      const messages = JSON.stringify(requests[0].body.messages);

      assert.match(messages, /生成 exactly one 个知识项/);
      assert.match(messages, /contentType 必须严格等于：concept_card/);
      assert.match(messages, /domain 必须严格等于：数学/);
      assert.match(messages, /subdomain 必须严格等于：函数/);
      assert.match(messages, /relations 必须返回空数组/);
      assert.match(messages, /一次函数/);
    } finally {
      restoreEnv("ADMIN_IMPORT_PROVIDER", originalAdminProvider);
      restoreEnv("AI_PROVIDER", originalAiProvider);
      restoreEnv("AI_API_KEY", originalAiApiKey);
      restoreEnv("AI_MODEL", originalAiModel);
      globalThis.fetch = originalFetch;
    }
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

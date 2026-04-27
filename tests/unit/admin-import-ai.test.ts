import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAdminImportJsonSchema,
  extractResponseOutputText,
  generateAdminImportBatch,
  generateMockAdminImportBatch,
} from "@/server/admin/admin-import-ai";

describe("admin import AI provider", () => {
  it("creates a strict structured output schema", () => {
    const schema = createAdminImportJsonSchema();

    assert.equal(schema.type, "json_schema");
    assert.equal(schema.strict, true);
    assert.equal(schema.schema.additionalProperties, false);
    assert.deepEqual(schema.schema.required, ["sourceTitle", "defaultDomain", "items", "relations"]);
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
    assert.equal(batch.items.length, 1);
    assert.equal(batch.items[0].slug, "mock-linear-equation");
    assert.equal(batch.items[0].reviewItems.length, 3);
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

  it("extracts text from raw Responses API output", () => {
    assert.equal(
      extractResponseOutputText({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: "{\"items\":[]}",
              },
            ],
          },
        ],
      }),
      "{\"items\":[]}",
    );
  });
});

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

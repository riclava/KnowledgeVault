import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAdminImportJsonSchema,
  extractResponseOutputText,
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

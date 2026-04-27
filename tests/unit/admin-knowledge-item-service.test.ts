import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeAdminKnowledgeItemSearchParams } from "@/server/admin/admin-knowledge-item-service";

describe("admin knowledge item service", () => {
  it("normalizes list query params", () => {
    const params = normalizeAdminKnowledgeItemSearchParams(
      new URLSearchParams(
        "query=  algebra  &domain= Math &contentType=plain_text&difficulty=2&tag=core",
      ),
    );

    assert.deepEqual(params, {
      query: "algebra",
      domain: "Math",
      contentType: "plain_text",
      difficulty: 2,
      tag: "core",
    });
  });

  it("ignores invalid numeric filters", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("difficulty=nope"),
      ),
      {},
    );
  });
});

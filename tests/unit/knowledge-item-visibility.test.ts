import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildKnowledgeItemVisibilityWhere,
  buildOwnedKnowledgeItemData,
} from "@/server/repositories/knowledge-item-visibility";

describe("knowledge item visibility", () => {
  it("allows anonymous reads to public items only", () => {
    assert.deepEqual(buildKnowledgeItemVisibilityWhere(), { visibility: "public" });
  });

  it("allows authenticated learners to read public and own private items", () => {
    assert.deepEqual(buildKnowledgeItemVisibilityWhere("user_1"), {
      OR: [
        { visibility: "public" },
        { visibility: "private", createdByUserId: "user_1" },
      ],
    });
  });

  it("builds public and private ownership data", () => {
    assert.deepEqual(buildOwnedKnowledgeItemData({ scope: "admin" }), {
      visibility: "public",
      createdByUserId: null,
    });
    assert.deepEqual(
      buildOwnedKnowledgeItemData({ scope: "learner", userId: "user_1" }),
      {
        visibility: "private",
        createdByUserId: "user_1",
      },
    );
  });

  it("threads visibility filters through learner repositories", () => {
    for (const path of [
      "src/server/repositories/knowledge-item-repository.ts",
      "src/server/repositories/diagnostic-repository.ts",
      "src/server/repositories/review-repository.ts",
    ]) {
      const source = readFileSync(path, "utf8");

      assert.match(source, /buildKnowledgeItemVisibilityWhere/);
    }
  });
});

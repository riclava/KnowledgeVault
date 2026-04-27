import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAdminImportWritePlan,
  partitionReviewItemIdsForReplacement,
} from "@/server/admin/admin-import-repository";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";

const batch: AdminImportBatch = {
  defaultDomain: "数学",
  items: [
    {
      slug: "existing-item",
      title: "Existing Item Updated",
      contentType: "plain_text",
      renderPayload: { text: "Updated" },
      domain: "数学",
      summary: "Updated summary",
      body: "Updated body",
      useConditions: [],
      nonUseConditions: [],
      antiPatterns: [],
      typicalProblems: [],
      examples: [],
      difficulty: 2,
      tags: ["update"],
      variables: [],
      reviewItems: [{ type: "recall", prompt: "Q", answer: "A", difficulty: 2 }],
    },
    {
      slug: "new-item",
      title: "New Item",
      contentType: "plain_text",
      renderPayload: { text: "New" },
      domain: "数学",
      summary: "New summary",
      body: "New body",
      useConditions: [],
      nonUseConditions: [],
      antiPatterns: [],
      typicalProblems: [],
      examples: [],
      difficulty: 1,
      tags: ["new"],
      variables: [],
      reviewItems: [{ type: "recall", prompt: "Q", answer: "A", difficulty: 1 }],
    },
  ],
  relations: [
    {
      fromSlug: "existing-item",
      toSlug: "new-item",
      relationType: "related",
    },
  ],
};

describe("admin import write plan", () => {
  it("separates creates, updates, and relation sources", () => {
    const plan = buildAdminImportWritePlan(batch, new Map([["existing-item", "ki_existing"]]));

    assert.deepEqual(plan.createSlugs, ["new-item"]);
    assert.deepEqual(plan.updateSlugs, ["existing-item"]);
    assert.deepEqual(plan.relationSourceSlugs, ["existing-item"]);
  });

  it("preserves reviewed items and deletes only unreferenced review items", () => {
    const plan = partitionReviewItemIdsForReplacement([
      { id: "reviewed", _count: { reviewLogs: 2 } },
      { id: "unreviewed", _count: { reviewLogs: 0 } },
      { id: "also-reviewed", _count: { reviewLogs: 1 } },
    ]);

    assert.deepEqual(plan.deleteIds, ["unreviewed"]);
    assert.deepEqual(plan.preserveIds, ["reviewed", "also-reviewed"]);
  });
});

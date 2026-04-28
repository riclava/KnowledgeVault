import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInitialImportedKnowledgeItemState,
  buildPrivateImportSlugMap,
} from "@/server/admin/admin-import-repository";

describe("user private import", () => {
  it("keeps free slugs and suffixes occupied slugs for private imports", () => {
    const slugMap = buildPrivateImportSlugMap({
      requestedSlugs: ["linear-map", "chain-rule"],
      occupiedSlugs: new Set(["linear-map"]),
      namespace: "usrabc123456",
    });

    assert.deepEqual(Object.fromEntries(slugMap), {
      "linear-map": "linear-map-usrabc12",
      "chain-rule": "chain-rule",
    });
  });

  it("initializes imported knowledge as due now for the creator", () => {
    const now = new Date("2026-04-28T00:00:00.000Z");

    assert.deepEqual(
      buildInitialImportedKnowledgeItemState({
        userId: "user_1",
        knowledgeItemId: "item_1",
        difficulty: 4,
        now,
      }),
      {
        userId: "user_1",
        knowledgeItemId: "item_1",
        memoryStrength: 0.05,
        stability: 0,
        difficultyEstimate: 4,
        nextReviewAt: now,
      },
    );
  });
});

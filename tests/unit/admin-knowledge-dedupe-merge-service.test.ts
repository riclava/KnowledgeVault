import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeKnowledgeDedupeArrays,
  mergeKnowledgeDedupeUserState,
  normalizeKnowledgeDedupeMergeInput,
  replaceDiagnosticKnowledgeItemIds,
} from "@/server/admin/admin-knowledge-dedupe-merge-service";

describe("admin knowledge dedupe merge service", () => {
  it("dedupes simple array fields while preserving canonical order", () => {
    assert.deepEqual(
      mergeKnowledgeDedupeArrays(["a", "b"], [" b ", "c", "", "a"]),
      ["a", "b", "c"],
    );
  });

  it("merges learner state into the canonical knowledge item state", () => {
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-02-01T00:00:00.000Z");
    const soon = new Date("2026-03-01T00:00:00.000Z");
    const later = new Date("2026-04-01T00:00:00.000Z");

    assert.deepEqual(
      mergeKnowledgeDedupeUserState(
        {
          memoryStrength: 0.2,
          stability: 2,
          difficultyEstimate: 3,
          lastReviewedAt: older,
          nextReviewAt: later,
          totalReviews: 4,
          correctReviews: 3,
          lapseCount: 1,
          consecutiveCorrect: 2,
        },
        {
          memoryStrength: 0.8,
          stability: 8,
          difficultyEstimate: 2,
          lastReviewedAt: newer,
          nextReviewAt: soon,
          totalReviews: 5,
          correctReviews: 4,
          lapseCount: 2,
          consecutiveCorrect: 1,
        },
      ),
      {
        memoryStrength: 0.8,
        stability: 8,
        difficultyEstimate: 2,
        lastReviewedAt: newer,
        nextReviewAt: soon,
        totalReviews: 9,
        correctReviews: 7,
        lapseCount: 3,
        consecutiveCorrect: 2,
      },
    );
  });

  it("replaces diagnostic weak knowledge ids and removes duplicates", () => {
    assert.deepEqual(
      replaceDiagnosticKnowledgeItemIds(
        ["dup", "keep", "other", "dup"],
        new Map([["dup", "keep"]]),
      ),
      ["keep", "other"],
    );
  });

  it("normalizes merge requests", () => {
    assert.deepEqual(
      normalizeKnowledgeDedupeMergeInput({
        canonicalKnowledgeItemId: " keep ",
        mergedKnowledgeItemIds: [" dup ", "dup", "", " keep "],
      }),
      {
        canonicalKnowledgeItemId: "keep",
        mergedKnowledgeItemIds: ["dup"],
      },
    );
  });

  it("rejects incomplete merge requests", () => {
    assert.throws(
      () =>
        normalizeKnowledgeDedupeMergeInput({
          canonicalKnowledgeItemId: "",
          mergedKnowledgeItemIds: ["dup"],
        }),
      /保留知识项不能为空/,
    );
    assert.throws(
      () =>
        normalizeKnowledgeDedupeMergeInput({
          canonicalKnowledgeItemId: "keep",
          mergedKnowledgeItemIds: [],
        }),
      /请选择要合并的重复知识项/,
    );
  });
});

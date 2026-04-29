import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("review unstarted knowledge items", () => {
  it("backfills unstarted domain knowledge items once a learner has started that domain", () => {
    const service = readFileSync("src/server/services/review-service.ts", "utf8");
    const repository = readFileSync(
      "src/server/repositories/review-repository.ts",
      "utf8",
    );

    assert.match(service, /ensureUnstartedKnowledgeItemStatesForReview/);
    assert.match(service, /knowledgeItemStateCount > 0/);
    assert.match(service, /mode === "today"/);
    assert.match(repository, /userStates:\s*{\s*none:\s*{\s*userId/s);
    assert.match(repository, /nextReviewAt:\s*now/);
  });

  it("does not cap a due review session to eight items", () => {
    const service = readFileSync("src/server/services/review-service.ts", "utf8");

    assert.doesNotMatch(service, /REVIEW_QUEUE_LIMIT\s*=\s*8/);
    assert.doesNotMatch(service, /take:\s*REVIEW_QUEUE_LIMIT/);
  });
});

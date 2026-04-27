import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("review item active filtering", () => {
  it("filters learner review queues to active review items", () => {
    const repository = readFileSync(
      "src/server/repositories/review-repository.ts",
      "utf8",
    );

    assert.match(repository, /reviewItems:\s*{\s*where:\s*{\s*isActive:\s*true/s);
  });

  it("filters diagnostic review item selection to active review items", () => {
    const repository = readFileSync(
      "src/server/repositories/diagnostic-repository.ts",
      "utf8",
    );

    assert.match(repository, /where:\s*{\s*isActive:\s*true,[^}]*knowledgeItem:/s);
    assert.match(repository, /id:\s*{\s*in:\s*reviewItemIds/s);
    assert.match(repository, /isActive:\s*true,[^}]*knowledgeItem:/s);
  });

  it("filters public knowledge item details to active review items", () => {
    const repository = readFileSync(
      "src/server/repositories/knowledge-item-repository.ts",
      "utf8",
    );

    assert.match(
      repository,
      /knowledgeItemDetailInclude[\s\S]*reviewItems:\s*{\s*where:\s*{\s*isActive:\s*true/s,
    );
  });
});

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

  it("counts only active review items in public summaries", () => {
    const repository = readFileSync(
      "src/server/repositories/knowledge-item-repository.ts",
      "utf8",
    );
    const summaryInclude = between(
      repository,
      "function buildKnowledgeItemSummaryInclude",
      "const knowledgeItemDetailInclude",
    );

    assert.match(
      summaryInclude,
      /_count:\s*{\s*select:\s*{[\s\S]*reviewItems:\s*{\s*where:\s*{\s*isActive:\s*true/s,
    );
  });

  it("counts only active review items in public details", () => {
    const repository = readFileSync(
      "src/server/repositories/knowledge-item-repository.ts",
      "utf8",
    );
    const detailInclude = between(
      repository,
      "const knowledgeItemDetailInclude",
      "export async function listKnowledgeItems",
    );

    assert.match(
      detailInclude,
      /_count:\s*{\s*select:\s*{[\s\S]*reviewItems:\s*{\s*where:\s*{\s*isActive:\s*true/s,
    );
  });

  it("counts only active review items in diagnostic summaries", () => {
    const repository = readFileSync(
      "src/server/repositories/diagnostic-repository.ts",
      "utf8",
    );
    const diagnosticInclude = between(
      repository,
      "const diagnosticQuestionInclude",
      "export async function listDiagnosticReviewItems",
    );

    assert.match(
      diagnosticInclude,
      /_count:\s*{\s*select:\s*{[\s\S]*reviewItems:\s*{\s*where:\s*{\s*isActive:\s*true/s,
    );
  });
});

function between(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  assert.notEqual(startIndex, -1);
  assert.notEqual(endIndex, -1);

  return source.slice(startIndex, endIndex);
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("question active filtering", () => {
  it("filters learner review queues to active bound questions", () => {
    const repository = readFileSync(
      "src/server/repositories/review-repository.ts",
      "utf8",
    );

    assert.match(repository, /questionBindings:\s*{\s*where:\s*{\s*question:\s*{\s*isActive:\s*true/s);
  });

  it("filters diagnostic question selection to active bound questions", () => {
    const repository = readFileSync(
      "src/server/repositories/diagnostic-repository.ts",
      "utf8",
    );

    assert.match(repository, /question:\s*{\s*isActive:\s*true/s);
    assert.match(repository, /id:\s*{\s*in:\s*questionIds/s);
  });

  it("filters public knowledge item details to active bound questions", () => {
    const repository = readFileSync(
      "src/server/repositories/knowledge-item-repository.ts",
      "utf8",
    );

    assert.match(
      repository,
      /knowledgeItemDetailInclude[\s\S]*questionBindings:\s*{\s*where:\s*{\s*question:\s*{\s*isActive:\s*true/s,
    );
  });

  it("counts only active bound questions in public summaries", () => {
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
      /_count:\s*{\s*select:\s*{[\s\S]*questionBindings:\s*{\s*where:\s*{\s*question:\s*{\s*isActive:\s*true/s,
    );
  });

  it("counts only active bound questions in public details", () => {
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
      /_count:\s*{\s*select:\s*{[\s\S]*questionBindings:\s*{\s*where:\s*{\s*question:\s*{\s*isActive:\s*true/s,
    );
  });

  it("counts only active bound questions in diagnostic summaries", () => {
    const repository = readFileSync(
      "src/server/repositories/diagnostic-repository.ts",
      "utf8",
    );
    const diagnosticInclude = between(
      repository,
      "function buildDiagnosticQuestionInclude",
      "export async function listDiagnosticQuestions",
    );

    assert.match(
      diagnosticInclude,
      /_count:\s*{\s*select:\s*{[\s\S]*questionBindings:\s*{\s*where:\s*{\s*question:\s*{\s*isActive:\s*true/s,
    );
  });

  it("guards review submissions against archived or mismatched questions", () => {
    const service = readFileSync("src/server/services/review-service.ts", "utf8");
    const repository = readFileSync(
      "src/server/repositories/review-repository.ts",
      "utf8",
    );
    const submitReview = between(
      service,
      "export async function submitReview",
      "export async function deferReview",
    );

    assert.match(repository, /getActiveQuestionForKnowledgeItem/);
    assert.match(repository, /id:\s*questionId/);
    assert.match(repository, /knowledgeItemId/);
    assert.match(repository, /isActive:\s*true/);
    assert.match(submitReview, /getActiveQuestionForKnowledgeItem/);
    assert.match(submitReview, /Question is not active for this knowledge item/);
    assert.match(
      submitReview,
      /getActiveQuestionForKnowledgeItem[\s\S]*createQuestionAttempt/,
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

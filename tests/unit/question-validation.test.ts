import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeQuestion,
  normalizeSubmittedAnswer,
} from "@/lib/question-validation";

describe("question validation", () => {
  it("normalizes each supported question type", () => {
    assert.equal(
      normalizeQuestion({
        type: "single_choice",
        prompt: "Q",
        options: [{ id: "a", text: "A" }],
        answer: { optionId: "a" },
        difficulty: 2,
      }).gradingMode,
      "rule",
    );
    assert.equal(
      normalizeQuestion({
        type: "short_answer",
        prompt: "Explain",
        answer: { text: "Because..." },
        difficulty: 3,
      }).gradingMode,
      "ai",
    );
    assert.deepEqual(
      normalizeSubmittedAnswer("multiple_choice", {
        optionIds: ["b", "a", "a"],
      }),
      { optionIds: ["a", "b"] },
    );
  });

  it("rejects unsupported question shapes", () => {
    assert.throws(
      () =>
        normalizeQuestion({
          type: "single_choice",
          prompt: "Q",
          options: [],
          answer: { optionId: "a" },
          difficulty: 2,
        }),
      /options/i,
    );
    assert.throws(
      () =>
        normalizeQuestion({
          type: "fill_blank",
          prompt: "Q",
          answer: {},
          difficulty: 2,
        }),
      /answer/i,
    );
    assert.throws(
      () => normalizeSubmittedAnswer("true_false", { value: "yes" }),
      /boolean/i,
    );
  });
});

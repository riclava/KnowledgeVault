import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gradeQuestionAnswer } from "@/server/services/question-grading-service";

describe("question grading", () => {
  it("grades objective question types with rules", async () => {
    assert.equal(
      (
        await gradeQuestionAnswer({
          question: {
            type: "single_choice",
            answer: { optionId: "a" },
            answerAliases: [],
          },
          submittedAnswer: { optionId: "a" },
        })
      ).result,
      "correct",
    );
    assert.equal(
      (
        await gradeQuestionAnswer({
          question: {
            type: "multiple_choice",
            answer: { optionIds: ["a", "c"] },
            answerAliases: [],
          },
          submittedAnswer: { optionIds: ["c", "a"] },
        })
      ).result,
      "correct",
    );
    assert.equal(
      (
        await gradeQuestionAnswer({
          question: {
            type: "true_false",
            answer: { value: true },
            answerAliases: [],
          },
          submittedAnswer: { value: false },
        })
      ).result,
      "incorrect",
    );
    assert.equal(
      (
        await gradeQuestionAnswer({
          question: {
            type: "fill_blank",
            answer: { text: "Bayes" },
            answerAliases: ["Bayes theorem"],
          },
          submittedAnswer: { text: " bayes theorem " },
        })
      ).result,
      "correct",
    );
  });

  it("uses AI grading for short answers", async () => {
    const result = await gradeQuestionAnswer({
      question: {
        type: "short_answer",
        prompt: "Why?",
        answer: { text: "Because causes update beliefs." },
        answerAliases: [],
        explanation: "Bayesian update",
      },
      submittedAnswer: { text: "It updates beliefs from evidence." },
      aiGrader: async () => ({
        result: "partial",
        score: 0.6,
        feedback: "方向对，但缺少原因说明。",
      }),
    });

    assert.deepEqual(result, {
      result: "partial",
      score: 0.6,
      feedback: "方向对，但缺少原因说明。",
    });
  });
});

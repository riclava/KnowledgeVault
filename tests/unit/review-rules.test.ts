import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateNextReviewState,
  chooseReviewItemType,
  getReviewMultiplier,
  mapQuestionAttemptToReviewGrade,
  REVIEW_INTERVAL_MS,
} from "../../src/server/services/review-rules";

const baseState = {
  memoryStrength: 0.5,
  stability: 2,
  difficultyEstimate: 3,
  totalReviews: 4,
  correctReviews: 2,
  lapseCount: 1,
  consecutiveCorrect: 0,
};

describe("review scheduling rules", () => {
  it("schedules again after 10 minutes and records a lapse", () => {
    const now = new Date("2026-04-22T00:00:00.000Z");
    const nextState = calculateNextReviewState({
      state: baseState,
      result: "again",
      now,
    });

    assert.equal(
      nextState.nextReviewAt.getTime() - now.getTime(),
      REVIEW_INTERVAL_MS.again,
    );
    assert.equal(nextState.lapseCount, 2);
    assert.equal(nextState.consecutiveCorrect, 0);
    assert.equal(nextState.correctReviews, 2);
  });

  it("applies interval multipliers after sustained correct reviews", () => {
    const now = new Date("2026-04-22T00:00:00.000Z");
    const nextState = calculateNextReviewState({
      state: {
        ...baseState,
        consecutiveCorrect: 4,
      },
      result: "easy",
      now,
    });

    assert.equal(getReviewMultiplier(5), 3);
    assert.equal(
      nextState.nextReviewAt.getTime() - now.getTime(),
      REVIEW_INTERVAL_MS.easy * 3,
    );
    assert.equal(nextState.consecutiveCorrect, 5);
  });
});

describe("review queue item selection", () => {
  it("uses preferred type when available", () => {
    assert.equal(
      chooseReviewItemType({
        availableTypes: ["single_choice", "fill_blank"],
        preferredType: "fill_blank",
      }),
      "fill_blank",
    );
  });

  it("falls back to the first available type", () => {
    assert.equal(
      chooseReviewItemType({
        availableTypes: ["single_choice", "fill_blank"],
        preferredType: "short_answer",
      }),
      "single_choice",
    );
  });
});

describe("question result mapping", () => {
  it("maps question attempt results onto review grades", () => {
    assert.equal(
      mapQuestionAttemptToReviewGrade({ result: "correct", score: 1 }),
      "easy",
    );
    assert.equal(
      mapQuestionAttemptToReviewGrade({ result: "correct", score: 0.8 }),
      "good",
    );
    assert.equal(
      mapQuestionAttemptToReviewGrade({ result: "partial", score: 0.6 }),
      "hard",
    );
    assert.equal(
      mapQuestionAttemptToReviewGrade({ result: "incorrect", score: 0 }),
      "again",
    );
  });
});

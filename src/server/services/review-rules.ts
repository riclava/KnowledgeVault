import type { QuestionAttemptResult, QuestionType } from "@/types/question";
import type { ReviewGrade } from "@/types/review";

export const REVIEW_INTERVAL_MS: Record<ReviewGrade, number> = {
  again: 10 * 60 * 1000,
  hard: 24 * 60 * 60 * 1000,
  good: 3 * 24 * 60 * 60 * 1000,
  easy: 7 * 24 * 60 * 60 * 1000,
};

export const REVIEW_TYPE_CYCLE: QuestionType[] = [
  "single_choice",
  "fill_blank",
  "true_false",
  "short_answer",
];

export type ReviewRuleState = {
  memoryStrength: number;
  stability: number;
  difficultyEstimate: number;
  totalReviews: number;
  correctReviews: number;
  lapseCount: number;
  consecutiveCorrect: number;
};

export function calculateNextReviewState({
  state,
  result,
  now,
}: {
  state: ReviewRuleState;
  result: ReviewGrade;
  now: Date;
}) {
  const correct = result === "good" || result === "easy";
  const nextConsecutiveCorrect = correct ? state.consecutiveCorrect + 1 : 0;
  const multiplier = getReviewMultiplier(nextConsecutiveCorrect);
  const nextReviewAt = new Date(
    now.getTime() + REVIEW_INTERVAL_MS[result] * multiplier,
  );

  return {
    memoryStrength: clamp(
      result === "again"
        ? state.memoryStrength - 0.35
        : result === "hard"
          ? state.memoryStrength - 0.15
          : result === "good"
            ? state.memoryStrength + 0.2
            : state.memoryStrength + 0.3,
      0.05,
      1,
    ),
    stability: clamp(
      result === "again"
        ? 0
        : result === "hard"
          ? state.stability - 1
          : result === "good"
            ? state.stability + 1
            : state.stability + 2,
      0,
      365,
    ),
    difficultyEstimate: clamp(
      result === "again"
        ? state.difficultyEstimate + 0.4
        : result === "hard"
          ? state.difficultyEstimate + 0.2
          : result === "good"
            ? state.difficultyEstimate - 0.1
            : state.difficultyEstimate - 0.2,
      1,
      5,
    ),
    lastReviewedAt: now,
    nextReviewAt,
    totalReviews: state.totalReviews + 1,
    correctReviews: state.correctReviews + (correct ? 1 : 0),
    lapseCount: state.lapseCount + (result === "again" ? 1 : 0),
    consecutiveCorrect: nextConsecutiveCorrect,
  };
}

export function chooseQuestionType({
  availableTypes,
  preferredType,
}: {
  availableTypes: QuestionType[];
  preferredType: QuestionType;
}) {
  return availableTypes.includes(preferredType)
    ? preferredType
    : availableTypes[0] ?? null;
}

export function getReviewMultiplier(consecutiveCorrect: number) {
  if (consecutiveCorrect >= 5) {
    return 3;
  }

  if (consecutiveCorrect >= 3) {
    return 2;
  }

  return 1;
}

export function mapQuestionAttemptToReviewGrade({
  result,
  score,
}: {
  result: QuestionAttemptResult;
  score: number;
}): ReviewGrade {
  if (result === "correct") {
    return score >= 0.95 ? "easy" : "good";
  }

  if (result === "partial") {
    return "hard";
  }

  return "again";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

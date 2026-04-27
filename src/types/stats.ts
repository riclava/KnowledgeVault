import type { ReviewGrade } from "@/types/review";

export type WeakKnowledgeItemStat = {
  knowledgeItemId: string;
  slug: string;
  title: string;
  domain: string;
  summary: string;
  latestResult: ReviewGrade | null;
  againCount: number;
  hardCount: number;
  nextReviewAt: string | null;
  memoryHookCount: number;
  reason: string;
  weakPoint: "concept" | "application" | "boundary" | "retention";
  recommendedAction: string;
};

export type MemoryHookActivity = {
  id: string;
  knowledgeItemId: string;
  knowledgeItemTitle: string;
  content: string;
  source: "created" | "used";
  timestamp: string;
};

export type SummaryStats = {
  latestSession: {
    id: string;
    domain: string;
    startedAt: string;
    completedAt: string | null;
    reviewCount: number;
    durationMinutes: number;
    averageResponseTimeMs: number | null;
    grades: Record<ReviewGrade, number>;
  } | null;
  nextSuggestedReviewAt: string | null;
  immediateWeakKnowledgeItems: WeakKnowledgeItemStat[];
  memoryHookActivity: MemoryHookActivity[];
  advancedStats: {
    totalReviews: number;
    correctRate: number | null;
    averageResponseTimeMs: number | null;
    reviewTypeBreakdown: Array<{
      type: "recall" | "recognition" | "application";
      label: string;
      count: number;
      weakCount: number;
    }>;
    sevenDayTrend: Array<{
      date: string;
      count: number;
      correctCount: number;
    }>;
  };
  learningRecommendations: Array<{
    id: string;
    label: string;
    description: string;
    href: string;
    priority: "high" | "medium" | "low";
  }>;
  metrics: Array<{
    id:
      | "first_review_completion_rate"
      | "daily_review_completion_rate"
      | "next_day_return_rate"
      | "again_hard_recovery_rate"
      | "weak_knowledgeItem_click_rate"
      | "memory_hook_creation_rate";
    label: string;
    value: number | null;
    description: string;
  }>;
};

export type ProgressStats = {
  trackedKnowledgeItemCount: number;
  dueNowCount: number;
  scheduledCount: number;
  stableCount: number;
  weakCount: number;
  memoryHookKnowledgeItemCount: number;
  latestDiagnosticAt: string | null;
};

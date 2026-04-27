import type { KnowledgeItemSummary } from "@/types/knowledge-item";

export type ReviewGrade = "again" | "hard" | "good" | "easy";
export type ReviewItemKind = "recall" | "recognition" | "application";
export type ReviewHintSource = "memory_hook" | "one_line_use";
export type ReviewMode = "today" | "weak";

export type ReviewQueueItem = {
  reviewItemId: string;
  knowledgeItemId: string;
  type: ReviewItemKind;
  prompt: string;
  answer: string;
  explanation: string | null;
  difficulty: number;
  reviewReason: {
    label: string;
    detail: string;
  };
  knowledgeItem: KnowledgeItemSummary & {
    body: string;
  };
};

export type ReviewSessionPayload = {
  sessionId: string | null;
  domain: string | null;
  mode: ReviewMode;
  items: ReviewQueueItem[];
  estimatedMinutes: number;
  emptyReason:
    | "no_due_reviews"
    | "needs_diagnostic"
    | "no_review_content"
    | null;
};

export type ReviewSubmitInput = {
  sessionId: string;
  reviewItemId: string;
  knowledgeItemId: string;
  result: ReviewGrade;
  responseTimeMs?: number;
  memoryHookUsedId?: string;
  completed?: boolean;
};

export type ReviewSubmitResult = {
  sessionId: string;
  knowledgeItemId: string;
  nextReviewAt: string;
  result: ReviewGrade;
};

export type ReviewHint = {
  knowledgeItemId: string;
  content: string;
  source: ReviewHintSource;
  memoryHookUsedId: string | null;
};

export type ReviewSessionSnapshot = {
  id: string;
  domain: string;
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  reviewCount: number;
  grades: Record<ReviewGrade, number>;
};

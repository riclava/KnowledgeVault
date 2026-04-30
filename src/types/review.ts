import type { KnowledgeItemSummary } from "@/types/knowledge-item";
import type {
  QuestionAnswer,
  QuestionOption,
  QuestionType,
} from "@/types/question";

export type ReviewGrade = "again" | "hard" | "good" | "easy";
export type ReviewItemKind = QuestionType;
export type ReviewHintSource = "memory_hook" | "one_line_use" | "ai";
export type ReviewMode = "today" | "weak";

export type ReviewQueueItem = {
  questionId: string;
  knowledgeItemId: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  answer: QuestionAnswer;
  answerAliases: string[];
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
  questionId: string;
  knowledgeItemId: string;
  submittedAnswer: QuestionAnswer;
  responseTimeMs?: number;
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

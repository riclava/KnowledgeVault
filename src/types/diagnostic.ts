import type { KnowledgeItemSummary } from "@/types/knowledge-item";

export type DiagnosticAssessment = "none" | "partial" | "clear";

export type DiagnosticQuestion = {
  id: string;
  knowledgeItemId: string;
  type: "recall" | "recognition" | "application";
  prompt: string;
  answer: string;
  explanation: string | null;
  difficulty: number;
  knowledgeItem: KnowledgeItemSummary;
};

export type DiagnosticStart = {
  domain: string;
  questions: DiagnosticQuestion[];
};

export type DiagnosticSubmission = {
  domain: string;
  answers: Array<{
    reviewItemId: string;
    assessment: DiagnosticAssessment;
  }>;
};

export type DiagnosticResult = {
  id: string;
  domain: string;
  reviewItemIds: string[];
  weakKnowledgeItemIds: string[];
  completedAt: string;
  weakKnowledgeItems: KnowledgeItemSummary[];
  reviewQueueKnowledgeItemIds: string[];
};

import type { KnowledgeItemSummary } from "@/types/knowledge-item";
import type { QuestionAnswer, QuestionOption, QuestionType } from "@/types/question";

export type DiagnosticAssessment = "none" | "partial" | "clear";

export type DiagnosticQuestion = {
  id: string;
  knowledgeItemIds: string[];
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  answer: QuestionAnswer;
  answerAliases: string[];
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
    questionId: string;
    assessment: DiagnosticAssessment;
  }>;
};

export type DiagnosticResult = {
  id: string;
  domain: string;
  questionIds: string[];
  weakKnowledgeItemIds: string[];
  completedAt: string;
  weakKnowledgeItems: KnowledgeItemSummary[];
  reviewQueueKnowledgeItemIds: string[];
};

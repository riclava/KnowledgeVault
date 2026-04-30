import type { MemoryHookRecord } from "@/types/memory-hook";

export type KnowledgeItemType =
  | "math_formula"
  | "vocabulary"
  | "plain_text"
  | "concept_card"
  | "comparison_table"
  | "procedure";

export type MathFormulaRenderPayload = {
  latex: string;
  explanation: string;
  variables: Array<{
    symbol: string;
    name: string;
    meaning: string;
  }>;
};

export type VocabularyRenderPayload = {
  term: string;
  definition: string;
  examples: string[];
};

export type PlainTextRenderPayload = {
  text: string;
};

export type ConceptCardRenderPayload = {
  definition: string;
  keyPoints: string[];
  misconceptions: string[];
};

export type ComparisonTableRenderPayload = {
  subjects: string[];
  aspects: Array<{
    label: string;
    values: string[];
  }>;
};

export type ProcedureRenderPayload = {
  steps: Array<{
    title: string;
    detail: string;
  }>;
  pitfalls: string[];
};

export type KnowledgeItemRenderPayloadByType = {
  math_formula: MathFormulaRenderPayload;
  vocabulary: VocabularyRenderPayload;
  plain_text: PlainTextRenderPayload;
  concept_card: ConceptCardRenderPayload;
  comparison_table: ComparisonTableRenderPayload;
  procedure: ProcedureRenderPayload;
};

export type KnowledgeItemRenderPayload =
  | ({ type: "math_formula" } & MathFormulaRenderPayload)
  | ({ type: "vocabulary" } & VocabularyRenderPayload)
  | ({ type: "plain_text" } & PlainTextRenderPayload)
  | ({ type: "concept_card" } & ConceptCardRenderPayload)
  | ({ type: "comparison_table" } & ComparisonTableRenderPayload)
  | ({ type: "procedure" } & ProcedureRenderPayload);

export type KnowledgeItemTrainingStatus =
  | "not_started"
  | "weak"
  | "due_now"
  | "learning"
  | "scheduled"
  | "stable";

export type KnowledgeItemSummary = {
  id: string;
  slug: string;
  title: string;
  contentType: KnowledgeItemType;
  renderPayload: KnowledgeItemRenderPayloadByType[KnowledgeItemType];
  domain: string;
  subdomain: string | null;
  summary: string;
  difficulty: number;
  tags: string[];
  reviewItemCount: number;
  memoryHookCount: number;
  trainingStatus: KnowledgeItemTrainingStatus;
  trainingStatusLabel: string;
  nextReviewAt: string | null;
  isWeak: boolean;
  isDueNow: boolean;
  hasPersonalMemoryHook: boolean;
  totalReviews: number;
  correctReviews: number;
};

export type KnowledgeItemDetail = KnowledgeItemSummary & {
  body: string;
  reviewItems: Array<{
    id: string;
    type: "recall" | "recognition" | "application";
    prompt: string;
    answer: string;
    explanation: string | null;
    difficulty: number;
  }>;
  memoryHooks: MemoryHookRecord[];
};

export type KnowledgeItemRelationDetail = {
  id: string;
  relationType: "prerequisite" | "related" | "confusable" | "application_of";
  note: string | null;
  knowledgeItem: KnowledgeItemSummary;
};

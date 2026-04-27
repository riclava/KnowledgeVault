import type { MemoryHookRecord } from "@/types/memory-hook";

export type KnowledgeItemType = "math_formula" | "vocabulary" | "plain_text";

export type MathFormulaRenderPayload = {
  latex: string;
};

export type VocabularyRenderPayload = {
  term: string;
  definition: string;
  phonetic: string;
  partOfSpeech: string;
  examples: string[];
};

export type PlainTextRenderPayload = {
  text: string;
};

export type KnowledgeItemRenderPayloadByType = {
  math_formula: MathFormulaRenderPayload;
  vocabulary: VocabularyRenderPayload;
  plain_text: PlainTextRenderPayload;
};

export type KnowledgeItemRenderPayload =
  | ({ type: "math_formula" } & MathFormulaRenderPayload)
  | ({ type: "vocabulary" } & VocabularyRenderPayload)
  | ({ type: "plain_text" } & PlainTextRenderPayload);

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
  variablePreview: Array<{
    symbol: string;
    name: string;
  }>;
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

export type KnowledgeItemCatalog = {
  knowledgeItems: KnowledgeItemSummary[];
  filters: {
    domains: string[];
    tags: string[];
    difficulties: number[];
    contentTypes: KnowledgeItemType[];
  };
};

export type KnowledgeItemDetail = KnowledgeItemSummary & {
  body: string;
  intuition: string | null;
  deepDive: string | null;
  useConditions: string[];
  nonUseConditions: string[];
  antiPatterns: string[];
  typicalProblems: string[];
  examples: string[];
  variables: Array<{
    id: string;
    symbol: string;
    name: string;
    description: string;
    unit: string | null;
    sortOrder: number;
  }>;
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

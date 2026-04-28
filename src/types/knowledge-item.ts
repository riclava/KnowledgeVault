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

export type ConceptCardRenderPayload = {
  definition: string;
  intuition: string;
  keyPoints: string[];
  examples: string[];
  misconceptions: string[];
};

export type ComparisonTableRenderPayload =
  | {
      mode: "matrix";
      subjects: string[];
      aspects: Array<{
        label: string;
        values: string[];
      }>;
    }
  | {
      mode: "table";
      columns: string[];
      rows: string[][];
    };

export type ProcedureRenderPayload = {
  mode: "flowchart";
  title: string;
  overview: string;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    tips: string[];
    pitfalls: string[];
  }>;
  nodes: Array<{
    id: string;
    label: string;
    kind: "start" | "step" | "decision" | "end";
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string | null;
  }>;
  mermaid: string;
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

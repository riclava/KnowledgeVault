import type { KnowledgeItemRelationDetail } from "@/types/knowledge-item";

export type ContentAssistDraftStatus = "draft" | "approved";

export type ContentAssistReviewItemDraft = {
  type: "recall" | "recognition" | "application";
  prompt: string;
  answer: string;
  explanation: string;
  difficulty: number;
};

export type ContentAssistRelationDraft = {
  toSlug: string;
  toTitle: string;
  relationType: KnowledgeItemRelationDetail["relationType"];
  note: string;
};

export type ContentAssistVariableDraft = {
  symbol: string;
  name: string;
  description: string;
  unit?: string | null;
};

export type ContentAssistDraft = {
  schemaVersion: 1;
  knowledgeItemId: string;
  knowledgeItemSlug: string;
  knowledgeItemTitle: string;
  knowledgeItemDomain: string;
  status: ContentAssistDraftStatus;
  generator: {
    id: "heuristic-v1";
    label: string;
  };
  generatedAt: string;
  updatedAt: string;
  approvedAt: string | null;
  reviewerNotes: string;
  explanation: {
    summary: string;
    body: string;
    useConditions: string[];
    nonUseConditions: string[];
    antiPatterns: string[];
    typicalProblems: string[];
    variableExplanations: ContentAssistVariableDraft[];
  };
  reviewItems: ContentAssistReviewItemDraft[];
  relationCandidates: ContentAssistRelationDraft[];
};

export type ContentAssistWorkspaceItem = {
  knowledgeItemId: string;
  knowledgeItemSlug: string;
  title: string;
  domain: string;
  summary: string;
  difficulty: number;
  draftStatus: ContentAssistDraftStatus | null;
  draftUpdatedAt: string | null;
  approvedAt: string | null;
};

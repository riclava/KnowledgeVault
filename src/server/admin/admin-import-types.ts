import type {
  KnowledgeItemRelationType,
  KnowledgeItemType,
  ReviewItemType,
} from "@/generated/prisma/client";

export type AdminImportedVariable = {
  symbol: string;
  name: string;
  description: string;
  unit?: string;
  sortOrder?: number;
};

export type AdminImportedReviewItem = {
  type: ReviewItemType;
  prompt: string;
  answer: string;
  explanation?: string;
  difficulty: number;
};

export type AdminImportedKnowledgeItem = {
  slug: string;
  title: string;
  contentType: KnowledgeItemType;
  renderPayload: unknown;
  domain: string;
  subdomain?: string;
  summary: string;
  body: string;
  intuition?: string;
  deepDive?: string;
  useConditions: string[];
  nonUseConditions: string[];
  antiPatterns: string[];
  typicalProblems: string[];
  examples: string[];
  tags: string[];
  difficulty: number;
  variables: AdminImportedVariable[];
  reviewItems: AdminImportedReviewItem[];
};

export type AdminImportedRelation = {
  fromSlug: string;
  toSlug: string;
  relationType: KnowledgeItemRelationType;
  note?: string;
};

export type AdminImportBatch = {
  sourceTitle?: string;
  defaultDomain?: string;
  items: AdminImportedKnowledgeItem[];
  relations: AdminImportedRelation[];
};

export type AdminImportValidationErrorCode =
  | "empty_batch"
  | "duplicate_slug"
  | "invalid_slug"
  | "missing_item_field"
  | "invalid_content_type"
  | "invalid_render_payload"
  | "non_chinese_domain"
  | "invalid_difficulty"
  | "invalid_array_field"
  | "missing_review_item"
  | "invalid_review_item"
  | "duplicate_variable"
  | "unknown_relation_source"
  | "unknown_relation_target"
  | "self_relation"
  | "duplicate_relation"
  | "invalid_relation_type";

export type AdminImportValidationError = {
  code: AdminImportValidationErrorCode;
  path: string;
  message: string;
};

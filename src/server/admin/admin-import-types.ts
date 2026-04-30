import type {
  KnowledgeItemRelationType,
  KnowledgeItemType,
  QuestionType,
} from "@/generated/prisma/client";

export type AdminImportedQuestion = {
  type: QuestionType;
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
  tags: string[];
  difficulty: number;
  questions: AdminImportedQuestion[];
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

export type AdminImportDedupeWarning = {
  generatedSlug: string;
  generatedTitle: string;
  score: number;
  reasons: {
    kind: string;
    score: number;
    detail: string;
  }[];
  existingItem: {
    id: string;
    slug: string;
    title: string;
    domain: string;
    subdomain?: string;
    summary: string;
  };
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
  | "missing_question"
  | "invalid_question"
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

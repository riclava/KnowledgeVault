import type {
  AdminBulkGenerateImportRunStatus,
  AdminBulkGenerateImportRowStatus,
  KnowledgeItemType,
} from "@/generated/prisma/client";
import type {
  AdminImportDedupeWarning,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";

export type AdminBulkGenerateImportRowInput = {
  lineNumber: number;
  sourceText: string;
};

export type AdminBulkGenerateImportRequest = {
  contentType: KnowledgeItemType;
  domain: string;
  subdomain?: string;
  rows: AdminBulkGenerateImportRowInput[];
};

export type AdminBulkGenerateImportCounts = {
  totalCount: number;
  importedCount: number;
  failedCount: number;
  duplicateSkippedCount: number;
  canceledCount: number;
  pendingCount: number;
  processingCount: number;
};

export type AdminBulkGenerateImportRowForCounts = {
  status: AdminBulkGenerateImportRowStatus;
};

export type AdminBulkGenerateImportRunSummary = AdminBulkGenerateImportCounts & {
  id: string;
  status: AdminBulkGenerateImportRunStatus;
  contentType: KnowledgeItemType;
  domain: string;
  subdomain?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
};

export type AdminBulkGenerateImportRowResult = {
  id: string;
  lineNumber: number;
  sourceText: string;
  status: AdminBulkGenerateImportRowStatus;
  generatedSlug?: string;
  generatedTitle?: string;
  savedKnowledgeItemId?: string;
  duplicateWarnings: AdminImportDedupeWarning[];
  validationErrors: AdminImportValidationError[];
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
};

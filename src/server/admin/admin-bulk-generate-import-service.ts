import type {
  AdminBulkGenerateImportRunStatus,
  AdminBulkGenerateImportRowStatus,
  KnowledgeItemType,
} from "@/generated/prisma/client";
import type {
  AdminBulkGenerateImportGenerateInput,
} from "@/server/admin/admin-bulk-generate-import-ai";
import { generateAdminBulkGenerateImportItemBatch } from "@/server/admin/admin-bulk-generate-import-ai";
import {
  adminBulkGenerateImportRepository,
  getAdminBulkGenerateImportRunForAdmin,
} from "@/server/admin/admin-bulk-generate-import-repository";
import {
  findAdminImportDedupeWarnings,
} from "@/server/admin/admin-import-service";
import {
  listExistingKnowledgeItemIdsBySlug,
  saveAdminImportBatch,
} from "@/server/admin/admin-import-repository";
import type {
  AdminBulkGenerateImportCounts,
  AdminBulkGenerateImportRequest,
  AdminBulkGenerateImportRowForCounts,
  AdminBulkGenerateImportRunSummary,
} from "@/server/admin/admin-bulk-generate-import-types";
import type {
  AdminImportBatch,
  AdminImportDedupeWarning,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";
import type { AdminImportValidationResult } from "@/server/admin/admin-import-validation";
import { validateAdminImportBatch } from "@/server/admin/admin-import-validation";

const CONTENT_TYPES = new Set<KnowledgeItemType>([
  "math_formula",
  "vocabulary",
  "plain_text",
  "concept_card",
  "comparison_table",
  "procedure",
]);
const MAX_BULK_GENERATE_IMPORT_ROWS = 10000;
const BULK_GENERATE_IMPORT_CONCURRENCY = 3;
const FAILED_ROW_STATUSES = new Set<AdminBulkGenerateImportRowStatus>([
  "ai_failed",
  "validation_failed",
  "save_failed",
]);

export function normalizeAdminBulkGenerateImportRequest(
  input: unknown,
): AdminBulkGenerateImportRequest {
  const record = isRecord(input) ? input : {};
  const contentType = text(record.contentType);
  const domain = text(record.domain);
  const subdomain = optionalText(record.subdomain);

  if (!isKnowledgeItemType(contentType)) {
    throw new Error("内容类型无效。");
  }

  if (!domain) {
    throw new Error("领域不能为空。");
  }

  const rawLines = Array.isArray(record.lines) ? record.lines : [];
  const rows = rawLines.flatMap((line, index) => {
    const sourceText = text(line);

    return sourceText ? [{ lineNumber: index + 1, sourceText }] : [];
  });

  if (rows.length === 0) {
    throw new Error("至少需要一行知识点。");
  }

  if (rows.length > MAX_BULK_GENERATE_IMPORT_ROWS) {
    throw new Error(`一次最多支持 ${MAX_BULK_GENERATE_IMPORT_ROWS} 行。`);
  }

  return {
    contentType,
    domain,
    ...(subdomain ? { subdomain } : {}),
    rows,
  };
}

export function countAdminBulkGenerateImportRows(
  rows: AdminBulkGenerateImportRowForCounts[],
): AdminBulkGenerateImportCounts {
  return rows.reduce<AdminBulkGenerateImportCounts>(
    (counts, row) => {
      counts.totalCount += 1;

      if (row.status === "imported") {
        counts.importedCount += 1;
      } else if (row.status === "duplicate_skipped") {
        counts.duplicateSkippedCount += 1;
      } else if (row.status === "pending") {
        counts.pendingCount += 1;
      } else if (row.status === "processing") {
        counts.processingCount += 1;
      } else if (row.status === "canceled") {
        counts.canceledCount += 1;
      } else if (FAILED_ROW_STATUSES.has(row.status)) {
        counts.failedCount += 1;
      }

      return counts;
    },
    {
      totalCount: 0,
      importedCount: 0,
      failedCount: 0,
      duplicateSkippedCount: 0,
      canceledCount: 0,
      pendingCount: 0,
      processingCount: 0,
    },
  );
}

export type AdminBulkGenerateImportRunRepository = {
  createRun: (input: {
    adminUserId: string;
    contentType: KnowledgeItemType;
    domain: string;
    subdomain: string | undefined;
    rows: AdminBulkGenerateImportRequest["rows"];
  }) => Promise<{ id: string }>;
};

export type AdminBulkGenerateImportRunListRepository = {
  listRuns: (adminUserId: string) => Promise<AdminBulkGenerateImportRunSummary[]>;
};

export type AdminBulkGenerateImportRunCancelRepository = {
  cancelRun: (input: {
    adminUserId: string;
    runId: string;
  }) => Promise<{ canceled: boolean }>;
};

export type AdminBulkGenerateImportRunDeleteRepository = {
  deleteRun: (input: {
    adminUserId: string;
    runId: string;
  }) => Promise<{ deleted: boolean }>;
};

export type AdminBulkGenerateImportPendingRow = {
  id: string;
  lineNumber: number;
  sourceText: string;
};

export type AdminBulkGenerateImportRunSettings = {
  contentType: KnowledgeItemType;
  domain: string;
  subdomain: string | undefined;
};

export type AdminBulkGenerateImportProcessorRepository = {
  getRunStatus: (runId: string) => Promise<AdminBulkGenerateImportRunStatus>;
  getRunSettings: (
    runId: string,
  ) => Promise<AdminBulkGenerateImportRunSettings>;
  markRunRunning: (runId: string) => Promise<void>;
  listPendingRows: (
    runId: string,
  ) => Promise<AdminBulkGenerateImportPendingRow[]>;
  markRowProcessing: (rowId: string) => Promise<boolean>;
  markRowImported: (input: {
    rowId: string;
    generatedSlug: string;
    generatedTitle: string;
    savedKnowledgeItemId: string;
    aiOutput: AdminImportBatch;
  }) => Promise<void>;
  markRowDuplicateSkipped: (input: {
    rowId: string;
    generatedSlug: string;
    generatedTitle: string;
    duplicateWarnings: AdminImportDedupeWarning[];
    aiOutput: AdminImportBatch;
  }) => Promise<void>;
  markRowFailed: (input: {
    rowId: string;
    status: Extract<
      AdminBulkGenerateImportRowStatus,
      "ai_failed" | "validation_failed" | "save_failed"
    >;
    errorMessage: string;
    validationErrors?: AdminImportValidationError[];
    aiOutput?: AdminImportBatch;
  }) => Promise<void>;
  markRunCompleted: (runId: string) => Promise<void>;
  markRunFailed: (input: {
    runId: string;
    errorMessage: string;
  }) => Promise<void>;
};

export type AdminBulkGenerateImportProcessorDependencies = {
  repository: AdminBulkGenerateImportProcessorRepository;
  generateBatch: (
    input: AdminBulkGenerateImportGenerateInput,
  ) => Promise<AdminImportBatch>;
  validateBatch: (
    batch: AdminImportBatch,
  ) => Promise<AdminImportValidationResult> | AdminImportValidationResult;
  findDedupeWarnings: (
    batch: AdminImportBatch,
  ) => Promise<AdminImportDedupeWarning[]>;
  saveBatch: (input: {
    batch: AdminImportBatch;
    sourceExcerpt: string;
  }) => Promise<{ savedKnowledgeItemId: string }>;
};

export async function createAdminBulkGenerateImportRun({
  adminUserId,
  input,
  repository,
}: {
  adminUserId: string;
  input: unknown;
  repository: AdminBulkGenerateImportRunRepository;
}) {
  const normalized = normalizeAdminBulkGenerateImportRequest(input);
  const run = await repository.createRun({
    adminUserId,
    contentType: normalized.contentType,
    domain: normalized.domain,
    subdomain: normalized.subdomain,
    rows: normalized.rows,
  });

  return { runId: run.id };
}

export async function createAdminBulkGenerateImportRunForAdmin({
  adminUserId,
  input,
}: {
  adminUserId: string;
  input: unknown;
}) {
  return createAdminBulkGenerateImportRun({
    adminUserId,
    input,
    repository: adminBulkGenerateImportRepository,
  });
}

export async function listAdminBulkGenerateImportRuns({
  adminUserId,
  repository,
}: {
  adminUserId: string;
  repository: AdminBulkGenerateImportRunListRepository;
}) {
  return repository.listRuns(adminUserId);
}

export async function listAdminBulkGenerateImportRunsForAdmin({
  adminUserId,
}: {
  adminUserId: string;
}) {
  return listAdminBulkGenerateImportRuns({
    adminUserId,
    repository: adminBulkGenerateImportRepository,
  });
}

export async function cancelAdminBulkGenerateImportRun({
  adminUserId,
  runId,
  repository,
}: {
  adminUserId: string;
  runId: string;
  repository: AdminBulkGenerateImportRunCancelRepository;
}) {
  const result = await repository.cancelRun({ adminUserId, runId });

  return { runId, canceled: result.canceled };
}

export async function deleteAdminBulkGenerateImportRun({
  adminUserId,
  runId,
  repository,
}: {
  adminUserId: string;
  runId: string;
  repository: AdminBulkGenerateImportRunDeleteRepository;
}) {
  const result = await repository.deleteRun({ adminUserId, runId });

  return { runId, deleted: result.deleted };
}

export async function cancelAdminBulkGenerateImportRunForAdmin({
  adminUserId,
  runId,
}: {
  adminUserId: string;
  runId: string;
}) {
  return cancelAdminBulkGenerateImportRun({
    adminUserId,
    runId,
    repository: adminBulkGenerateImportRepository,
  });
}

export async function deleteAdminBulkGenerateImportRunForAdmin({
  adminUserId,
  runId,
}: {
  adminUserId: string;
  runId: string;
}) {
  return deleteAdminBulkGenerateImportRun({
    adminUserId,
    runId,
    repository: adminBulkGenerateImportRepository,
  });
}

export async function getAdminBulkGenerateImportRunDetailForAdmin({
  adminUserId,
  runId,
}: {
  adminUserId: string;
  runId: string;
}) {
  return getAdminBulkGenerateImportRunForAdmin({ adminUserId, runId });
}

export async function startAdminBulkGenerateImportRunForAdmin({
  adminUserId,
  runId,
}: {
  adminUserId: string;
  runId: string;
}) {
  const run = await getAdminBulkGenerateImportRunForAdmin({
    adminUserId,
    runId,
  });

  if (!run) {
    throw new Error("批量生成任务不存在。");
  }

  if (run.status !== "pending") {
    return { runId };
  }

  queueMicrotask(() => {
    void processAdminBulkGenerateImportRun({
      runId,
      repository: adminBulkGenerateImportRepository,
      generateBatch: generateAdminBulkGenerateImportItemBatch,
      validateBatch: (batch) => validateAdminImportBatch(batch, new Set()),
      findDedupeWarnings: findAdminImportDedupeWarnings,
      saveBatch: async ({ batch, sourceExcerpt }) => {
        const importRun = await saveAdminImportBatch({
          adminUserId,
          sourceTitle: batch.sourceTitle,
          sourceExcerpt,
          batch,
          aiOutput: batch,
        });
        const slugToId = await listExistingKnowledgeItemIdsBySlug(
          batch.items.map((item) => item.slug),
        );
        const firstSlug = batch.items[0]?.slug ?? "";

        return {
          savedKnowledgeItemId: slugToId.get(firstSlug) ?? importRun.id,
        };
      },
    });
  });

  return { runId };
}

export async function processAdminBulkGenerateImportRun({
  runId,
  repository,
  generateBatch,
  validateBatch,
  findDedupeWarnings,
  saveBatch,
}: {
  runId: string;
} & AdminBulkGenerateImportProcessorDependencies) {
  try {
    const settings = await repository.getRunSettings(runId);

    if (await isAdminBulkGenerateImportRunCanceled(repository, runId)) {
      return;
    }

    await repository.markRunRunning(runId);

    const rows = await repository.listPendingRows(runId);

    await processAdminBulkGenerateImportRowsWithConcurrency({
      runId,
      rows,
      settings,
      repository,
      generateBatch,
      validateBatch,
      findDedupeWarnings,
      saveBatch,
    });

    if (!(await isAdminBulkGenerateImportRunCanceled(repository, runId))) {
      await repository.markRunCompleted(runId);
    }
  } catch (error) {
    await repository.markRunFailed({
      runId,
      errorMessage: error instanceof Error ? error.message : "批量生成任务失败。",
    });
  }
}

async function processAdminBulkGenerateImportRowsWithConcurrency({
  runId,
  rows,
  settings,
  repository,
  generateBatch,
  validateBatch,
  findDedupeWarnings,
  saveBatch,
}: {
  runId: string;
  rows: AdminBulkGenerateImportPendingRow[];
  settings: AdminBulkGenerateImportRunSettings;
} & AdminBulkGenerateImportProcessorDependencies) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < rows.length) {
      if (await isAdminBulkGenerateImportRunCanceled(repository, runId)) {
        return;
      }

      const row = rows[nextIndex];
      nextIndex += 1;

      if (!row) {
        return;
      }

      await processAdminBulkGenerateImportRow({
        row,
        settings,
        repository,
        generateBatch,
        validateBatch,
        findDedupeWarnings,
        saveBatch,
      });
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(BULK_GENERATE_IMPORT_CONCURRENCY, rows.length) },
      () => worker(),
    ),
  );
}

async function isAdminBulkGenerateImportRunCanceled(
  repository: AdminBulkGenerateImportProcessorRepository,
  runId: string,
) {
  try {
    return (await repository.getRunStatus(runId)) === "canceled";
  } catch {
    return true;
  }
}

async function processAdminBulkGenerateImportRow({
  row,
  settings,
  repository,
  generateBatch,
  validateBatch,
  findDedupeWarnings,
  saveBatch,
}: {
  row: AdminBulkGenerateImportPendingRow;
  settings: AdminBulkGenerateImportRunSettings;
} & AdminBulkGenerateImportProcessorDependencies) {
  const claimed = await repository.markRowProcessing(row.id);

  if (!claimed) {
    return;
  }

  let generated: AdminImportBatch;

  try {
    generated = await generateBatch({
      sourceText: row.sourceText,
      contentType: settings.contentType,
      domain: settings.domain,
      subdomain: settings.subdomain,
    });
  } catch (error) {
    await repository.markRowFailed({
      rowId: row.id,
      status: "ai_failed",
      errorMessage: errorMessage(error, "AI 生成失败。"),
    });
    return;
  }

  const validation = await validateBatch(generated);

  if (!validation.ok) {
    await repository.markRowFailed({
      rowId: row.id,
      status: "validation_failed",
      errorMessage: validation.errors[0]?.message ?? "生成内容校验失败。",
      validationErrors: validation.errors,
      aiOutput: generated,
    });
    return;
  }

  const dedupeWarnings = await findDedupeWarnings(validation.batch);
  const generatedItem = validation.batch.items[0];

  if (dedupeWarnings.length > 0) {
    await repository.markRowDuplicateSkipped({
      rowId: row.id,
      generatedSlug: generatedItem?.slug ?? "",
      generatedTitle: generatedItem?.title ?? "",
      duplicateWarnings: dedupeWarnings,
      aiOutput: validation.batch,
    });
    return;
  }

  try {
    const saved = await saveBatch({
      batch: validation.batch,
      sourceExcerpt: row.sourceText,
    });

    await repository.markRowImported({
      rowId: row.id,
      generatedSlug: generatedItem?.slug ?? "",
      generatedTitle: generatedItem?.title ?? "",
      savedKnowledgeItemId: saved.savedKnowledgeItemId,
      aiOutput: validation.batch,
    });
  } catch (error) {
    await repository.markRowFailed({
      rowId: row.id,
      status: "save_failed",
      errorMessage: errorMessage(error, "导入保存失败。"),
      aiOutput: validation.batch,
    });
  }
}

function isKnowledgeItemType(value: string): value is KnowledgeItemType {
  return CONTENT_TYPES.has(value as KnowledgeItemType);
}

function optionalText(value: unknown) {
  const normalized = text(value);

  return normalized || undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

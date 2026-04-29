import {
  Prisma,
  type AdminBulkGenerateImportRowStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  AdminBulkGenerateImportRunCancelRepository,
  AdminBulkGenerateImportRunDeleteRepository,
  AdminBulkGenerateImportRunRepository,
  AdminBulkGenerateImportRunListRepository,
  AdminBulkGenerateImportProcessorRepository,
  AdminBulkGenerateImportRecoveryRepository,
} from "@/server/admin/admin-bulk-generate-import-service";
import type {
  AdminBulkGenerateImportRowResult,
} from "@/server/admin/admin-bulk-generate-import-types";
import type {
  AdminImportDedupeWarning,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";

type AdminBulkGenerateImportRowRecord = {
  id: string;
  lineNumber: number;
  sourceText: string;
  status: AdminBulkGenerateImportRowStatus;
  generatedSlug: string | null;
  generatedTitle: string | null;
  savedKnowledgeItemId: string | null;
  duplicateWarnings: Prisma.JsonValue | null;
  validationErrors: Prisma.JsonValue | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

export const adminBulkGenerateImportRepository:
    AdminBulkGenerateImportRunRepository &
    AdminBulkGenerateImportRunListRepository &
    AdminBulkGenerateImportRunCancelRepository &
    AdminBulkGenerateImportRunDeleteRepository &
    AdminBulkGenerateImportProcessorRepository &
    AdminBulkGenerateImportRecoveryRepository = {
  async createRun({ adminUserId, contentType, domain, subdomain, rows }) {
    return prisma.adminBulkGenerateImportRun.create({
      data: {
        adminUserId,
        contentType,
        domain,
        subdomain: subdomain ?? null,
        totalCount: rows.length,
        rows: {
          create: rows.map((row) => ({
            lineNumber: row.lineNumber,
            sourceText: row.sourceText,
          })),
        },
      },
      select: { id: true },
    });
  },

  async listRuns(adminUserId) {
    const runs = await prisma.adminBulkGenerateImportRun.findMany({
      where: { adminUserId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        rows: {
          select: { status: true },
        },
      },
    });

    return runs.map((run) => ({
      id: run.id,
      status: run.status,
      contentType: run.contentType,
      domain: run.domain,
      subdomain: run.subdomain ?? undefined,
      ...countRows(run.rows),
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      errorMessage: run.errorMessage ?? undefined,
    }));
  },

  async cancelRun({ adminUserId, runId }) {
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const canceledRun = await tx.adminBulkGenerateImportRun.updateMany({
        where: {
          id: runId,
          adminUserId,
          status: { in: ["pending", "running"] },
        },
        data: {
          status: "canceled",
          errorMessage: null,
          completedAt: now,
        },
      });

      if (canceledRun.count > 0) {
        await tx.adminBulkGenerateImportRow.updateMany({
          where: {
            runId,
            status: "pending",
          },
          data: {
            status: "canceled",
            completedAt: now,
          },
        });
      }

      return canceledRun;
    });

    return { canceled: result.count > 0 };
  },

  async deleteRun({ adminUserId, runId }) {
    const result = await prisma.adminBulkGenerateImportRun.deleteMany({
      where: {
        id: runId,
        adminUserId,
        status: { in: ["completed", "failed", "canceled"] },
        rows: {
          none: {
            status: "processing",
          },
        },
      },
    });

    return { deleted: result.count > 0 };
  },

  async getRunStatus(runId) {
    const run = await prisma.adminBulkGenerateImportRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });

    if (!run) {
      throw new Error("批量生成任务不存在。");
    }

    return run.status;
  },

  async listInterruptedRuns() {
    const runs = await prisma.adminBulkGenerateImportRun.findMany({
      where: {
        status: { in: ["pending", "running"] },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        adminUserId: true,
      },
    });

    return runs;
  },

  async resetInterruptedRows(runId) {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.adminBulkGenerateImportRow.updateMany({
        where: {
          runId,
          status: "processing",
        },
        data: {
          status: "pending",
          startedAt: null,
          completedAt: null,
          errorMessage: null,
        },
      });

      await tx.adminBulkGenerateImportRun.updateMany({
        where: {
          id: runId,
          status: { in: ["pending", "running"] },
        },
        data: {
          status: "pending",
          errorMessage: null,
          completedAt: null,
          updatedAt: now,
        },
      });
    });

    await refreshRunCounts(runId);
  },

  async getRunSettings(runId) {
    const run = await prisma.adminBulkGenerateImportRun.findUnique({
      where: { id: runId },
      select: {
        contentType: true,
        domain: true,
        subdomain: true,
      },
    });

    if (!run) {
      throw new Error("批量生成任务不存在。");
    }

    return {
      contentType: run.contentType,
      domain: run.domain,
      subdomain: run.subdomain ?? undefined,
    };
  },

  async markRunRunning(runId) {
    await prisma.adminBulkGenerateImportRun.updateMany({
      where: { id: runId, status: "pending" },
      data: {
        status: "running",
        errorMessage: null,
        startedAt: new Date(),
      },
    });
  },

  async listPendingRows(runId) {
    return prisma.adminBulkGenerateImportRow.findMany({
      where: {
        runId,
        status: "pending",
      },
      orderBy: { lineNumber: "asc" },
      select: {
        id: true,
        lineNumber: true,
        sourceText: true,
      },
    });
  },

  async markRowProcessing(rowId) {
    const result = await prisma.adminBulkGenerateImportRow.updateMany({
      where: {
        id: rowId,
        status: "pending",
        run: {
          status: {
            not: "canceled",
          },
        },
      },
      data: {
        status: "processing",
        startedAt: new Date(),
        errorMessage: null,
      },
    });

    if (result.count === 0) {
      return false;
    }

    const row = await prisma.adminBulkGenerateImportRow.findUnique({
      where: { id: rowId },
      select: { runId: true },
    });

    if (row) {
      await refreshRunCounts(row.runId);
    }

    return true;
  },

  async markRowImported({
    rowId,
    generatedSlug,
    generatedTitle,
    savedKnowledgeItemId,
    aiOutput,
  }) {
    await updateRowAndRefreshRunCounts({
      rowId,
      data: {
        status: "imported",
        generatedSlug,
        generatedTitle,
        savedKnowledgeItemId,
        aiOutput: toNullableJsonInput(aiOutput),
        completedAt: new Date(),
      },
    });
  },

  async markRowDuplicateSkipped({
    rowId,
    generatedSlug,
    generatedTitle,
    duplicateWarnings,
    aiOutput,
  }) {
    await updateRowAndRefreshRunCounts({
      rowId,
      data: {
        status: "duplicate_skipped",
        generatedSlug,
        generatedTitle,
        duplicateWarnings: toNullableJsonInput(duplicateWarnings),
        aiOutput: toNullableJsonInput(aiOutput),
        completedAt: new Date(),
      },
    });
  },

  async markRowFailed({
    rowId,
    status,
    errorMessage,
    validationErrors,
    aiOutput,
  }) {
    await updateRowAndRefreshRunCounts({
      rowId,
      data: {
        status,
        errorMessage,
        validationErrors: toNullableJsonInput(validationErrors),
        aiOutput: toNullableJsonInput(aiOutput),
        completedAt: new Date(),
      },
    });
  },

  async markRunCompleted(runId) {
    await refreshRunCounts(runId);
    await prisma.adminBulkGenerateImportRun.updateMany({
      where: {
        id: runId,
        status: { not: "canceled" },
      },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
  },

  async markRunFailed({ runId, errorMessage }) {
    await prisma.adminBulkGenerateImportRun.updateMany({
      where: {
        id: runId,
        status: { not: "canceled" },
      },
      data: {
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      },
    });
  },
};

export async function getAdminBulkGenerateImportRunForAdmin({
  adminUserId,
  runId,
}: {
  adminUserId: string;
  runId: string;
}) {
  const run = await prisma.adminBulkGenerateImportRun.findFirst({
    where: {
      id: runId,
      adminUserId,
    },
    include: {
      rows: {
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  if (!run) {
    return null;
  }

  const counts = countRows(run.rows);

  return {
    id: run.id,
    status: run.status,
    contentType: run.contentType,
    domain: run.domain,
    subdomain: run.subdomain ?? undefined,
    ...counts,
    startedAt: run.startedAt?.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    errorMessage: run.errorMessage ?? undefined,
    rows: run.rows.map(toRowResult),
  };
}

async function updateRowAndRefreshRunCounts({
  rowId,
  data,
}: {
  rowId: string;
  data: Prisma.AdminBulkGenerateImportRowUpdateInput;
}) {
  const row = await prisma.adminBulkGenerateImportRow.update({
    where: { id: rowId },
    data,
    select: { runId: true },
  });

  await refreshRunCounts(row.runId);
}

async function refreshRunCounts(runId: string) {
  const rows = await prisma.adminBulkGenerateImportRow.findMany({
    where: { runId },
    select: { status: true },
  });
  const counts = countRows(rows);

  await prisma.adminBulkGenerateImportRun.update({
    where: { id: runId },
    data: {
      importedCount: counts.importedCount,
      failedCount: counts.failedCount,
      duplicateSkippedCount: counts.duplicateSkippedCount,
    },
  });
}

function toRowResult(
  row: AdminBulkGenerateImportRowRecord,
): AdminBulkGenerateImportRowResult {
  return {
    id: row.id,
    lineNumber: row.lineNumber,
    sourceText: row.sourceText,
    status: row.status,
    generatedSlug: row.generatedSlug ?? undefined,
    generatedTitle: row.generatedTitle ?? undefined,
    savedKnowledgeItemId: row.savedKnowledgeItemId ?? undefined,
    duplicateWarnings: asArray<AdminImportDedupeWarning>(row.duplicateWarnings),
    validationErrors: asArray<AdminImportValidationError>(row.validationErrors),
    errorMessage: row.errorMessage ?? undefined,
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function countRows(rows: Array<{ status: AdminBulkGenerateImportRowStatus }>) {
  return rows.reduce(
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
      } else {
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

function toNullableJsonInput(
  value: unknown,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

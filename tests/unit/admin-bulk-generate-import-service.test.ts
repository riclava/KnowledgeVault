import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cancelAdminBulkGenerateImportRun,
  countAdminBulkGenerateImportRows,
  createAdminBulkGenerateImportRun,
  deleteAdminBulkGenerateImportRun,
  listAdminBulkGenerateImportRuns,
  normalizeAdminBulkGenerateImportRequest,
  processAdminBulkGenerateImportRun,
  recoverInterruptedAdminBulkGenerateImportRuns,
} from "@/server/admin/admin-bulk-generate-import-service";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";

describe("admin bulk generate import service", () => {
  it("normalizes request lines while preserving original line numbers", () => {
    const input = normalizeAdminBulkGenerateImportRequest({
      contentType: " concept_card ",
      domain: " 数学 ",
      subdomain: " 代数 ",
      lines: ["  一次函数  ", "", "  ", "二次函数"],
    });

    assert.deepEqual(input, {
      contentType: "concept_card",
      domain: "数学",
      subdomain: "代数",
      rows: [
        { lineNumber: 1, sourceText: "一次函数" },
        { lineNumber: 4, sourceText: "二次函数" },
      ],
    });
  });

  it("rejects invalid request-level inputs", () => {
    assert.throws(
      () =>
        normalizeAdminBulkGenerateImportRequest({
          contentType: "flashcard",
          domain: "数学",
          lines: ["一次函数"],
        }),
      /内容类型无效/,
    );
    assert.throws(
      () =>
        normalizeAdminBulkGenerateImportRequest({
          contentType: "concept_card",
          domain: "",
          lines: ["一次函数"],
        }),
      /领域不能为空/,
    );
    assert.throws(
      () =>
        normalizeAdminBulkGenerateImportRequest({
          contentType: "concept_card",
          domain: "数学",
          lines: ["", "  "],
        }),
      /至少需要一行/,
    );
  });

  it("caps a run at 10000 non-empty rows", () => {
    assert.throws(
      () =>
        normalizeAdminBulkGenerateImportRequest({
          contentType: "plain_text",
          domain: "数学",
          lines: Array.from(
            { length: 10001 },
            (_, index) => `知识点 ${index + 1}`,
          ),
        }),
      /最多支持 10000 行/,
    );
  });

  it("counts row statuses for persisted progress summaries", () => {
    assert.deepEqual(
      countAdminBulkGenerateImportRows([
        { status: "pending" },
        { status: "processing" },
        { status: "imported" },
        { status: "duplicate_skipped" },
        { status: "ai_failed" },
        { status: "validation_failed" },
        { status: "save_failed" },
        { status: "canceled" },
      ]),
      {
        totalCount: 8,
        importedCount: 1,
        failedCount: 3,
        duplicateSkippedCount: 1,
        canceledCount: 1,
        pendingCount: 1,
        processingCount: 1,
      },
    );
  });

  it("creates a persisted run with one row per normalized input line", async () => {
    const captured: Record<string, unknown> = {};
    const result = await createAdminBulkGenerateImportRun({
      adminUserId: "admin_1",
      input: {
        contentType: "plain_text",
        domain: "数学",
        lines: ["一次函数", "", "二次函数"],
      },
      repository: {
        createRun: async (args) => {
          captured.createRun = args;

          return { id: "run_1" };
        },
      },
    });

    assert.deepEqual(result, { runId: "run_1" });
    assert.deepEqual(captured.createRun, {
      adminUserId: "admin_1",
      contentType: "plain_text",
      domain: "数学",
      subdomain: undefined,
      rows: [
        { lineNumber: 1, sourceText: "一次函数" },
        { lineNumber: 3, sourceText: "二次函数" },
      ],
    });
  });

  it("lists persisted runs for task management", async () => {
    const calls: string[] = [];
    const runs = await listAdminBulkGenerateImportRuns({
      adminUserId: "admin_1",
      repository: {
        listRuns: async (adminUserId) => {
          calls.push(adminUserId);

          return [
            {
              id: "run_1",
              status: "running",
              contentType: "concept_card",
              domain: "数学",
              subdomain: "函数",
              totalCount: 10,
              importedCount: 3,
              failedCount: 1,
              duplicateSkippedCount: 0,
              canceledCount: 0,
              pendingCount: 5,
              processingCount: 1,
              createdAt: "2026-04-29T07:00:00.000Z",
              startedAt: "2026-04-29T07:00:01.000Z",
            },
          ];
        },
      },
    });

    assert.deepEqual(calls, ["admin_1"]);
    assert.equal(runs[0]?.id, "run_1");
    assert.equal(runs[0]?.processingCount, 1);
  });

  it("cancels a persisted run for the admin", async () => {
    const calls: Array<{ adminUserId: string; runId: string }> = [];
    const result = await cancelAdminBulkGenerateImportRun({
      adminUserId: "admin_1",
      runId: "run_1",
      repository: {
        cancelRun: async (input) => {
          calls.push(input);

          return { canceled: true };
        },
      },
    });

    assert.deepEqual(calls, [{ adminUserId: "admin_1", runId: "run_1" }]);
    assert.deepEqual(result, { runId: "run_1", canceled: true });
  });

  it("deletes a terminal persisted run for the admin", async () => {
    const calls: Array<{ adminUserId: string; runId: string }> = [];
    const result = await deleteAdminBulkGenerateImportRun({
      adminUserId: "admin_1",
      runId: "run_1",
      repository: {
        deleteRun: async (input) => {
          calls.push(input);

          return { deleted: true };
        },
      },
    });

    assert.deepEqual(calls, [{ adminUserId: "admin_1", runId: "run_1" }]);
    assert.deepEqual(result, { runId: "run_1", deleted: true });
  });

  it("recovers pending and running runs after a process restart", async () => {
    const events: string[] = [];
    const result = await recoverInterruptedAdminBulkGenerateImportRuns({
      repository: {
        listInterruptedRuns: async () => [
          { id: "run_pending", adminUserId: "admin_1" },
          { id: "run_running", adminUserId: "admin_2" },
        ],
        resetInterruptedRows: async (runId) => {
          events.push(`${runId}:reset`);
        },
      },
      enqueueRun: async ({ runId, adminUserId }) => {
        events.push(`${runId}:enqueue:${adminUserId}`);
      },
    });

    assert.deepEqual(result, {
      recoveredCount: 2,
      runIds: ["run_pending", "run_running"],
    });
    assert.deepEqual(events, [
      "run_pending:reset",
      "run_pending:enqueue:admin_1",
      "run_running:reset",
      "run_running:enqueue:admin_2",
    ]);
  });

  it("stops picking more rows after a run is canceled", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: `row_${index + 1}`,
      lineNumber: index + 1,
      sourceText: `知识点 ${index + 1}`,
    }));
    const events: string[] = [];
    let status: "pending" | "running" | "completed" | "failed" | "canceled" =
      "running";

    await processAdminBulkGenerateImportRun({
      runId: "run_1",
      repository: {
        markRunRunning: async () => {},
        getRunStatus: async () => status,
        listPendingRows: async () => rows,
        markRowProcessing: async (rowId) => {
          events.push(`${rowId}:processing`);
          return true;
        },
        markRowImported: async (args) => {
          events.push(`${args.rowId}:imported`);
          status = "canceled";
        },
        markRowDuplicateSkipped: async () => {},
        markRowFailed: async () => {},
        markRunCompleted: async () => {
          events.push("run:completed");
        },
        markRunFailed: async () => {},
        getRunSettings: async () => ({
          contentType: "plain_text",
          domain: "数学",
          subdomain: undefined,
        }),
      },
      generateBatch: async ({ sourceText }) => makeBatch(sourceText),
      validateBatch: async (batch) => ({ ok: true, batch }),
      findDedupeWarnings: async () => [],
      saveBatch: async ({ batch }) => ({
        savedKnowledgeItemId: `${batch.items[0]?.slug ?? "item"}_id`,
      }),
    });

    assert.deepEqual(events, [
      "row_1:processing",
      "row_2:processing",
      "row_3:processing",
      "row_1:imported",
      "row_2:imported",
      "row_3:imported",
    ]);
  });

  it("processes rows independently and keeps going after validation failures", async () => {
    const events: string[] = [];
    const savedSources: string[] = [];

    await processAdminBulkGenerateImportRun({
      runId: "run_1",
      repository: {
        markRunRunning: async (runId) => {
          events.push(`run:${runId}:running`);
        },
        getRunStatus: async () => "running",
        listPendingRows: async () => [
          { id: "row_1", lineNumber: 1, sourceText: "一次函数" },
          { id: "row_2", lineNumber: 2, sourceText: "坏行" },
          { id: "row_3", lineNumber: 3, sourceText: "二次函数" },
        ],
        markRowProcessing: async (rowId) => {
          events.push(`${rowId}:processing`);
          return true;
        },
        markRowImported: async (args) => {
          events.push(`${args.rowId}:imported:${args.generatedSlug}`);
        },
        markRowDuplicateSkipped: async (args) => {
          events.push(`${args.rowId}:duplicate:${args.generatedSlug}`);
        },
        markRowFailed: async (args) => {
          events.push(`${args.rowId}:${args.status}:${args.errorMessage}`);
        },
        markRunCompleted: async (runId) => {
          events.push(`run:${runId}:completed`);
        },
        markRunFailed: async (args) => {
          events.push(`run:${args.runId}:failed`);
        },
        getRunSettings: async () => ({
          contentType: "plain_text",
          domain: "数学",
          subdomain: undefined,
        }),
      },
      generateBatch: async ({ sourceText }) => makeBatch(sourceText),
      validateBatch: async (batch) => {
        if (batch.items[0]?.title === "坏行") {
          return {
            ok: false,
            errors: [
              {
                code: "missing_item_field",
                path: "items.0.summary",
                message: "摘要不能为空。",
              },
            ],
          };
        }

        return { ok: true, batch };
      },
      findDedupeWarnings: async () => [],
      saveBatch: async ({ batch }) => {
        savedSources.push(batch.items[0]?.title ?? "");

        return { savedKnowledgeItemId: `item_${savedSources.length}` };
      },
    });

    assert.deepEqual(savedSources, ["一次函数", "二次函数"]);
    assert.equal(events[0], "run:run_1:running");
    assert.equal(events.at(-1), "run:run_1:completed");
    assert.deepEqual(
      events.slice(1, -1).sort(),
      [
        "row_1:imported:bulk-once",
        "row_1:processing",
        "row_2:processing",
        "row_2:validation_failed:摘要不能为空。",
        "row_3:imported:bulk-twice",
        "row_3:processing",
      ].sort(),
    );
  });

  it("skips duplicate rows instead of saving them", async () => {
    let saveCalled = false;
    const events: string[] = [];

    await processAdminBulkGenerateImportRun({
      runId: "run_1",
      repository: {
        markRunRunning: async () => {},
        getRunStatus: async () => "running",
        listPendingRows: async () => [
          { id: "row_1", lineNumber: 1, sourceText: "一次函数" },
        ],
        markRowProcessing: async () => true,
        markRowImported: async () => {
          events.push("imported");
        },
        markRowDuplicateSkipped: async (args) => {
          events.push(`duplicate:${args.generatedSlug}:${args.duplicateWarnings.length}`);
        },
        markRowFailed: async (args) => {
          events.push(args.status);
        },
        markRunCompleted: async () => {},
        markRunFailed: async () => {},
        getRunSettings: async () => ({
          contentType: "plain_text",
          domain: "数学",
          subdomain: undefined,
        }),
      },
      generateBatch: async ({ sourceText }) => makeBatch(sourceText),
      validateBatch: async (batch) => ({ ok: true, batch }),
      findDedupeWarnings: async () => [
        {
          generatedSlug: "bulk-once",
          generatedTitle: "一次函数",
          score: 0.9,
          reasons: [],
          existingItem: {
            id: "existing_1",
            slug: "linear-function",
            title: "一次函数",
            domain: "数学",
            summary: "一次函数知识。",
          },
        },
      ],
      saveBatch: async () => {
        saveCalled = true;

        return { savedKnowledgeItemId: "item_1" };
      },
    });

    assert.equal(saveCalled, false);
    assert.deepEqual(events, ["duplicate:bulk-once:1"]);
  });

  it("processes at most three rows concurrently", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: `row_${index + 1}`,
      lineNumber: index + 1,
      sourceText: `知识点 ${index + 1}`,
    }));
    const activeSources: string[] = [];
    const startedSources: string[] = [];
    const releases = new Map<string, () => void>();
    let maxActive = 0;

    const processing = processAdminBulkGenerateImportRun({
      runId: "run_1",
      repository: {
        markRunRunning: async () => {},
        getRunStatus: async () => "running",
        listPendingRows: async () => rows,
        markRowProcessing: async () => true,
        markRowImported: async () => {},
        markRowDuplicateSkipped: async () => {},
        markRowFailed: async () => {},
        markRunCompleted: async () => {},
        markRunFailed: async () => {},
        getRunSettings: async () => ({
          contentType: "plain_text",
          domain: "数学",
          subdomain: undefined,
        }),
      },
      generateBatch: async ({ sourceText }) => {
        startedSources.push(sourceText);
        activeSources.push(sourceText);
        maxActive = Math.max(maxActive, activeSources.length);

        await new Promise<void>((resolve) => {
          releases.set(sourceText, resolve);
        });

        activeSources.splice(activeSources.indexOf(sourceText), 1);

        return makeBatch(sourceText);
      },
      validateBatch: async (batch) => ({ ok: true, batch }),
      findDedupeWarnings: async () => [],
      saveBatch: async ({ batch }) => ({
        savedKnowledgeItemId: `${batch.items[0]?.slug ?? "item"}_id`,
      }),
    });

    await waitFor(() => releases.size === 3);

    assert.deepEqual(startedSources, ["知识点 1", "知识点 2", "知识点 3"]);
    assert.equal(maxActive, 3);

    releases.get("知识点 1")?.();
    await waitFor(() => releases.size === 4);

    assert.deepEqual(startedSources, [
      "知识点 1",
      "知识点 2",
      "知识点 3",
      "知识点 4",
    ]);
    assert.equal(maxActive, 3);

    releaseAll(releases);
    await waitFor(() => releases.size === 5);
    releaseAll(releases);

    await processing;
    assert.equal(maxActive, 3);
  });
});

function releaseAll(releases: Map<string, () => void>) {
  for (const release of releases.values()) {
    release();
  }
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Timed out waiting for condition.");
}

function makeBatch(title: string): AdminImportBatch {
  return {
    sourceTitle: title,
    defaultDomain: "数学",
    items: [
      {
        slug: title === "一次函数" ? "bulk-once" : "bulk-twice",
        title,
        contentType: "plain_text",
        renderPayload: { text: title },
        domain: "数学",
        summary: `${title}摘要`,
        body: `${title}正文`,
        useConditions: [],
        nonUseConditions: [],
        antiPatterns: [],
        typicalProblems: [],
        examples: [],
        tags: [],
        difficulty: 2,
        variables: [],
        reviewItems: [
          {
            type: "fill_blank",
            prompt: `${title}是什么？`,
            answer: title,
            difficulty: 2,
          },
        ],
      },
    ],
    relations: [],
  };
}

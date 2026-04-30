import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prisma } from "@/lib/db/prisma";
import {
  createKnowledgeDedupeRunForAdmin,
  normalizeKnowledgeDedupeScanInput,
} from "@/server/admin/admin-knowledge-dedupe-scan-service";

const duplicateItems = [
  {
    id: "item_a",
    title: "一元二次方程求根公式",
    slug: "quadratic-formula",
    summary: "一元二次方程的求根公式。",
    body: "通过判别式和求根公式求解 ax^2 + bx + c = 0。",
    contentType: "math_formula",
    tags: ["代数", "求根公式"],
  },
  {
    id: "item_b",
    title: "二次方程求根公式",
    slug: "quadratic-equation-root-formula",
    summary: "求解一元二次方程时使用的公式。",
    body: "使用 b^2 - 4ac 和求根公式判断并求出方程根。",
    contentType: "math_formula",
    tags: ["代数", "求根公式"],
  },
];

describe("admin knowledge dedupe scan service", () => {
  it("normalizes scan input with safe defaults", () => {
    assert.deepEqual(
      normalizeKnowledgeDedupeScanInput({
        domain: " 数学 ",
        subdomain: " 代数 ",
        threshold: "0.7",
        useAiReview: true,
      }),
      {
        domain: "数学",
        subdomain: "代数",
        threshold: 0.7,
        useAiReview: true,
      },
    );

    assert.deepEqual(normalizeKnowledgeDedupeScanInput({ domain: "数学" }), {
      domain: "数学",
      threshold: 0.55,
      useAiReview: false,
    });
  });

  it("rejects missing domains and unsafe thresholds", () => {
    assert.throws(
      () => normalizeKnowledgeDedupeScanInput({ domain: "" }),
      /领域不能为空/,
    );
    assert.throws(
      () => normalizeKnowledgeDedupeScanInput({ domain: "数学", threshold: 3 }),
      /阈值必须在 0 到 1 之间/,
    );
  });

  it("scans public items in the selected domain and persists candidate groups", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      findMany: (args: unknown) => Promise<typeof duplicateItems>;
    };
    const runDelegate = prisma.knowledgeDedupeRun as unknown as {
      create: (args: unknown) => Promise<{ id: string }>;
      update: (args: unknown) => Promise<unknown>;
    };
    const candidateDelegate = prisma.knowledgeDedupeCandidate as unknown as {
      createMany: (args: unknown) => Promise<{ count: number }>;
    };
    const originalFindMany = knowledgeItemDelegate.findMany;
    const originalRunCreate = runDelegate.create;
    const originalRunUpdate = runDelegate.update;
    const originalCandidateCreateMany = candidateDelegate.createMany;
    const captured: Record<string, unknown> = {};

    knowledgeItemDelegate.findMany = async (args: unknown) => {
      captured.findMany = args;

      return duplicateItems;
    };
    runDelegate.create = async (args: unknown) => {
      captured.runCreate = args;

      return { id: "run_1" };
    };
    runDelegate.update = async (args: unknown) => {
      captured.runUpdate = args;

      return {
        id: "run_1",
        status: "completed",
        candidateCount: 1,
      };
    };
    candidateDelegate.createMany = async (args: unknown) => {
      captured.candidateCreateMany = args;

      return { count: 1 };
    };

    try {
      const result = await createKnowledgeDedupeRunForAdmin({
        adminUserId: "admin_1",
        input: {
          domain: "数学",
          subdomain: "代数",
          threshold: 0.55,
          useAiReview: true,
        },
      });

      assert.deepEqual(result, {
        id: "run_1",
        status: "completed",
        candidateCount: 1,
      });
    } finally {
      knowledgeItemDelegate.findMany = originalFindMany;
      runDelegate.create = originalRunCreate;
      runDelegate.update = originalRunUpdate;
      candidateDelegate.createMany = originalCandidateCreateMany;
    }

    assert.deepEqual(captured.findMany, {
      where: {
        visibility: "public",
        domain: "数学",
        subdomain: "代数",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        body: true,
        contentType: true,
        tags: true,
      },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    });
    assert.deepEqual(captured.runCreate, {
      data: {
        adminUserId: "admin_1",
        domain: "数学",
        subdomain: "代数",
        threshold: 0.55,
        usedAiReview: true,
      },
      select: { id: true },
    });
    assert.ok(isRecord(captured.runUpdate));
    assert.deepEqual(captured.runUpdate.where, { id: "run_1" });
    assert.ok(isRecord(captured.runUpdate.data));
    assert.equal(captured.runUpdate.data.status, "completed");
    assert.equal(captured.runUpdate.data.candidateCount, 1);
    assert.equal(
      captured.runUpdate.data.warningMessage,
      "AI 复核暂未接入，本次仅使用本地相似度规则。",
    );
    assert.ok(captured.runUpdate.data.completedAt instanceof Date);
    assert.deepEqual(captured.runUpdate.select, {
      id: true,
      status: true,
      candidateCount: true,
    });
    assert.ok(isRecord(captured.candidateCreateMany));
    assert.ok(Array.isArray(captured.candidateCreateMany.data));
    assert.equal(captured.candidateCreateMany.data.length, 1);
    const candidate = captured.candidateCreateMany.data[0];
    assert.ok(isRecord(candidate));
    assert.equal(candidate.runId, "run_1");
    assert.deepEqual(candidate.knowledgeItemIds, ["item_a", "item_b"]);
    assert.equal(candidate.suggestedCanonicalItemId, "item_a");
    assert.equal(
      candidate.warningMessage,
      "AI 复核暂未接入，本次仅使用本地相似度规则。",
    );
    assert.equal(typeof candidate.localScore, "number");
    assert.ok(Array.isArray(candidate.localReasons));
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

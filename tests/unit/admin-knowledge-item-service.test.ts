import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prisma } from "@/lib/db/prisma";
import {
  getAdminKnowledgeItem,
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
} from "@/server/admin/admin-knowledge-item-service";

describe("admin knowledge item service", () => {
  it("normalizes list query params", () => {
    const params = normalizeAdminKnowledgeItemSearchParams(
      new URLSearchParams(
        "query=  algebra  &domain= Math &contentType=plain_text&difficulty=2&tag=core",
      ),
    );

    assert.deepEqual(params, {
      query: "algebra",
      domain: "Math",
      contentType: "plain_text",
      difficulty: 2,
      tag: "core",
    });
  });

  it("ignores invalid numeric filters", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("difficulty=nope"),
      ),
      {},
    );

    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("difficulty=2.5"),
      ),
      {},
    );
  });

  it("keeps integer difficulty filters outside the review scale", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(new URLSearchParams("difficulty=6")),
      { difficulty: 6 },
    );

    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(new URLSearchParams("difficulty=0")),
      { difficulty: 0 },
    );
  });

  it("passes zero difficulty filters into the Prisma where input", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      findMany: (args: unknown) => Promise<unknown>;
    };
    const originalFindMany = knowledgeItemDelegate.findMany;
    let capturedArgs: unknown;

    knowledgeItemDelegate.findMany = async (args: unknown) => {
      capturedArgs = args;

      return [];
    };

    try {
      await listAdminKnowledgeItems({ difficulty: 0 });
    } finally {
      knowledgeItemDelegate.findMany = originalFindMany;
    }

    assert.deepEqual(capturedArgs, {
      where: { difficulty: 0 },
      include: {
        _count: {
          select: {
            variables: true,
            reviewItems: true,
            outgoingRelations: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("loads only active review items for the admin edit form", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      findFirst: (args: unknown) => Promise<unknown>;
    };
    const originalFindFirst = knowledgeItemDelegate.findFirst;
    let capturedArgs: unknown;

    knowledgeItemDelegate.findFirst = async (args: unknown) => {
      capturedArgs = args;

      return null;
    };

    try {
      await getAdminKnowledgeItem("item-id");
    } finally {
      knowledgeItemDelegate.findFirst = originalFindFirst;
    }

    assert.deepEqual(capturedArgs, {
      where: {
        OR: [{ id: "item-id" }, { slug: "item-id" }],
      },
      include: {
        variables: {
          orderBy: { sortOrder: "asc" },
        },
        reviewItems: {
          where: { isActive: true },
          orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
        },
        outgoingRelations: {
          include: {
            toKnowledgeItem: {
              select: {
                id: true,
                slug: true,
                title: true,
              },
            },
          },
          orderBy: [{ relationType: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  });
});

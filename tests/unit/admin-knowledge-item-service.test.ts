import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prisma } from "@/lib/db/prisma";
import {
  getAdminKnowledgeItem,
  listAdminKnowledgeItemDomains,
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
} from "@/server/admin/admin-knowledge-item-service";

describe("admin knowledge item service", () => {
  it("normalizes list query params", () => {
    const params = normalizeAdminKnowledgeItemSearchParams(
      new URLSearchParams(
        "query=  algebra  &domain= Math &contentType=concept_card&difficulty=2&tag=core",
      ),
    );

    assert.deepEqual(params, {
      query: "algebra",
      domain: "Math",
      contentType: "concept_card",
      difficulties: [2],
      tag: "core",
    });
  });

  it("normalizes repeated difficulty filters", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("difficulty=1&difficulty=3&difficulty=5"),
      ),
      { difficulties: [1, 3, 5] },
    );
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
      { difficulties: [6] },
    );

    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(new URLSearchParams("difficulty=0")),
      { difficulties: [0] },
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
      await listAdminKnowledgeItems({ difficulties: [0, 2] });
    } finally {
      knowledgeItemDelegate.findMany = originalFindMany;
    }

    assert.deepEqual(capturedArgs, {
      where: { difficulty: { in: [0, 2] } },
      include: {
        _count: {
          select: {
            variables: true,
            reviewItems: {
              where: {
                isActive: true,
              },
            },
            outgoingRelations: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("lists distinct admin knowledge item domains alphabetically", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      findMany: (args: unknown) => Promise<{ domain: string }[]>;
    };
    const originalFindMany = knowledgeItemDelegate.findMany;
    let capturedArgs: unknown;

    knowledgeItemDelegate.findMany = async (args: unknown) => {
      capturedArgs = args;

      return [{ domain: "Math" }, { domain: "Writing" }];
    };

    try {
      assert.deepEqual(await listAdminKnowledgeItemDomains(), [
        "Math",
        "Writing",
      ]);
    } finally {
      knowledgeItemDelegate.findMany = originalFindMany;
    }

    assert.deepEqual(capturedArgs, {
      distinct: ["domain"],
      select: {
        domain: true,
      },
      orderBy: {
        domain: "asc",
      },
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

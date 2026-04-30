import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prisma } from "@/lib/db/prisma";
import {
  bulkUpdateAdminKnowledgeItemDomain,
  getAdminKnowledgeItem,
  listAdminKnowledgeItemDomainOptions,
  listAdminKnowledgeItemDomains,
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
} from "@/server/admin/admin-knowledge-item-service";

describe("admin knowledge item service", () => {
  it("normalizes list query params", () => {
    const params = normalizeAdminKnowledgeItemSearchParams(
      new URLSearchParams(
        "query=  algebra  &domain= Math &contentType=concept_card&difficulty=2&tag=core&page=3&pageSize=50",
      ),
    );

    assert.deepEqual(params, {
      query: "algebra",
      domain: "Math",
      contentType: "concept_card",
      difficulties: [2],
      tag: "core",
      page: 3,
      pageSize: 50,
    });
  });

  it("falls back to safe pagination defaults", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("page=0&pageSize=1000"),
      ),
      { page: 1, pageSize: 20 },
    );

    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("page=nope&pageSize=-1"),
      ),
      { page: 1, pageSize: 20 },
    );
  });

  it("normalizes repeated difficulty filters", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("difficulty=1&difficulty=3&difficulty=5"),
      ),
      { difficulties: [1, 3, 5], page: 1, pageSize: 20 },
    );
  });

  it("ignores invalid numeric filters", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("difficulty=nope"),
      ),
      { page: 1, pageSize: 20 },
    );

    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(
        new URLSearchParams("difficulty=2.5"),
      ),
      { page: 1, pageSize: 20 },
    );
  });

  it("keeps integer difficulty filters outside the review scale", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(new URLSearchParams("difficulty=6")),
      { difficulties: [6], page: 1, pageSize: 20 },
    );

    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(new URLSearchParams("difficulty=0")),
      { difficulties: [0], page: 1, pageSize: 20 },
    );
  });

  it("passes filters and pagination into Prisma list queries", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      findMany: (args: unknown) => Promise<unknown>;
      count: (args: unknown) => Promise<number>;
    };
    const originalFindMany = knowledgeItemDelegate.findMany;
    const originalCount = knowledgeItemDelegate.count;
    let capturedFindManyArgs: unknown;
    let capturedCountArgs: unknown;

    knowledgeItemDelegate.findMany = async (args: unknown) => {
      capturedFindManyArgs = args;

      return [];
    };
    knowledgeItemDelegate.count = async (args: unknown) => {
      capturedCountArgs = args;

      return 42;
    };

    try {
      assert.deepEqual(
        await listAdminKnowledgeItems({
          difficulties: [0, 2],
          page: 3,
          pageSize: 10,
        }),
        {
          items: [],
          total: 42,
          page: 3,
          pageSize: 10,
          pageCount: 5,
        },
      );
    } finally {
      knowledgeItemDelegate.findMany = originalFindMany;
      knowledgeItemDelegate.count = originalCount;
    }

    assert.deepEqual(capturedFindManyArgs, {
      where: { difficulty: { in: [0, 2] } },
      include: {
        createdByUser: {
          select: {
            displayName: true,
            email: true,
          },
        },
        _count: {
          select: {
            questionBindings: {
              where: {
                question: {
                  isActive: true,
                },
              },
            },
            outgoingRelations: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: 20,
      take: 10,
    });
    assert.deepEqual(capturedCountArgs, {
      where: { difficulty: { in: [0, 2] } },
    });
  });

  it("bulk updates the domain and subdomain for selected knowledge items", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    const originalUpdateMany = knowledgeItemDelegate.updateMany;
    let capturedArgs: unknown;

    knowledgeItemDelegate.updateMany = async (args: unknown) => {
      capturedArgs = args;

      return { count: 2 };
    };

    try {
      assert.deepEqual(
        await bulkUpdateAdminKnowledgeItemDomain({
          ids: [" first ", "second", "first", ""],
          domain: " 数学 ",
          subdomain: " 代数 ",
        }),
        { ok: true, count: 2 },
      );
    } finally {
      knowledgeItemDelegate.updateMany = originalUpdateMany;
    }

    assert.deepEqual(capturedArgs, {
      where: { id: { in: ["first", "second"] } },
      data: { domain: "数学", subdomain: "代数" },
    });
  });

  it("rejects incomplete bulk domain updates before touching Prisma", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    const originalUpdateMany = knowledgeItemDelegate.updateMany;
    let didUpdate = false;

    knowledgeItemDelegate.updateMany = async () => {
      didUpdate = true;

      return { count: 0 };
    };

    try {
      assert.deepEqual(
        await bulkUpdateAdminKnowledgeItemDomain({
          ids: [],
          domain: "数学",
          subdomain: "",
        }),
        { ok: false, error: "请选择要修改的知识项。" },
      );
      assert.deepEqual(
        await bulkUpdateAdminKnowledgeItemDomain({
          ids: ["item-id"],
          domain: " ",
          subdomain: "",
        }),
        { ok: false, error: "领域不能为空。" },
      );
    } finally {
      knowledgeItemDelegate.updateMany = originalUpdateMany;
    }

    assert.equal(didUpdate, false);
  });

  it("keeps existing subdomains when bulk update receives a blank subdomain", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    const originalUpdateMany = knowledgeItemDelegate.updateMany;
    let capturedArgs: unknown;

    knowledgeItemDelegate.updateMany = async (args: unknown) => {
      capturedArgs = args;

      return { count: 1 };
    };

    try {
      await bulkUpdateAdminKnowledgeItemDomain({
        ids: ["item-id"],
        domain: "数学",
        subdomain: " ",
      });
    } finally {
      knowledgeItemDelegate.updateMany = originalUpdateMany;
    }

    assert.deepEqual(capturedArgs, {
      where: { id: { in: ["item-id"] } },
      data: { domain: "数学" },
    });
  });

  it("clears subdomain when a bulk update explicitly asks to clear it", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    const originalUpdateMany = knowledgeItemDelegate.updateMany;
    let capturedArgs: unknown;

    knowledgeItemDelegate.updateMany = async (args: unknown) => {
      capturedArgs = args;

      return { count: 1 };
    };

    try {
      await bulkUpdateAdminKnowledgeItemDomain({
        ids: ["item-id"],
        domain: "数学",
        subdomain: " ",
        clearSubdomain: true,
      });
    } finally {
      knowledgeItemDelegate.updateMany = originalUpdateMany;
    }

    assert.deepEqual(capturedArgs, {
      where: { id: { in: ["item-id"] } },
      data: { domain: "数学", subdomain: null },
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

  it("lists existing domain and subdomain options for admin import editing", async () => {
    const knowledgeItemDelegate = prisma.knowledgeItem as unknown as {
      findMany: (args: unknown) => Promise<Array<{
        domain: string;
        subdomain: string | null;
      }>>;
    };
    const originalFindMany = knowledgeItemDelegate.findMany;
    let capturedArgs: unknown;

    knowledgeItemDelegate.findMany = async (args: unknown) => {
      capturedArgs = args;

      return [
        { domain: "数学", subdomain: "几何" },
        { domain: "数学", subdomain: "代数" },
        { domain: "写作", subdomain: null },
        { domain: "数学", subdomain: "几何" },
      ];
    };

    try {
      assert.deepEqual(await listAdminKnowledgeItemDomainOptions(), {
        domains: ["数学", "写作"],
        subdomainsByDomain: {
          数学: ["几何", "代数"],
          写作: [],
        },
      });
    } finally {
      knowledgeItemDelegate.findMany = originalFindMany;
    }

    assert.deepEqual(capturedArgs, {
      select: {
        domain: true,
        subdomain: true,
      },
      orderBy: [{ domain: "asc" }, { subdomain: "asc" }],
    });
  });

  it("loads only active bound questions for the admin edit form", async () => {
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
        createdByUser: {
          select: {
            displayName: true,
            email: true,
          },
        },
        questionBindings: {
          where: {
            question: {
              isActive: true,
            },
          },
          include: {
            question: true,
          },
          orderBy: { createdAt: "asc" },
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

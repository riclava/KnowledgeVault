import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

function buildKnowledgeItemSummaryInclude(userId?: string) {
  return {
    variables: {
      orderBy: {
        sortOrder: "asc" as const,
      },
      select: {
        symbol: true,
        name: true,
      },
    },
    userStates: {
      where: {
        userId: userId ?? "__anonymous_knowledgeItem_catalog__",
      },
      take: 1,
      select: {
        nextReviewAt: true,
        memoryStrength: true,
        lapseCount: true,
        consecutiveCorrect: true,
        totalReviews: true,
        correctReviews: true,
      },
    },
    memoryHooks: {
      where: {
        userId: userId ?? "__anonymous_knowledgeItem_catalog__",
      },
      take: 1,
      select: {
        id: true,
      },
    },
    _count: {
      select: {
        reviewItems: true,
        memoryHooks: true,
      },
    },
  } satisfies Prisma.KnowledgeItemInclude;
}

const knowledgeItemDetailInclude = {
  variables: {
    orderBy: {
      sortOrder: "asc" as const,
    },
  },
  reviewItems: {
    orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
  },
  memoryHooks: {
    where: {
      userId: "__knowledgeItem_detail_without_learner__",
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  _count: {
    select: {
      reviewItems: true,
      memoryHooks: true,
    },
  },
} satisfies Prisma.KnowledgeItemInclude;

export async function listKnowledgeItems({
  domain,
  tag,
  difficulty,
  query,
  userId,
}: {
  domain?: string;
  tag?: string;
  difficulty?: number;
  query?: string;
  userId?: string;
} = {}) {
  const normalizedQuery = query?.trim();
  const queryTokens = normalizedQuery
    ? normalizedQuery.split(/\s+/).filter(Boolean)
    : [];

  return prisma.knowledgeItem.findMany({
    where: {
      ...(domain ? { domain } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(typeof difficulty === "number" ? { difficulty } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              {
                title: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                summary: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                body: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                subdomain: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                variables: {
                  some: {
                    OR: [
                      {
                        symbol: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        name: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        description: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              },
              ...(queryTokens.length > 0 ? [{ tags: { hasSome: queryTokens } }] : []),
            ],
          }
        : {}),
    },
    include: buildKnowledgeItemSummaryInclude(userId),
    orderBy: [{ domain: "asc" }, { difficulty: "asc" }, { title: "asc" }],
  });
}

export async function listKnowledgeItemDomains() {
  const rows = await prisma.knowledgeItem.findMany({
    distinct: ["domain"],
    select: {
      domain: true,
    },
    orderBy: {
      domain: "asc",
    },
  });

  return rows.map((row) => row.domain);
}

export async function getKnowledgeItemByIdOrSlug(idOrSlug: string) {
  return prisma.knowledgeItem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: knowledgeItemDetailInclude,
  });
}

export async function listKnowledgeItemRelations(idOrSlug: string) {
  const knowledgeItem = await prisma.knowledgeItem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    select: {
      id: true,
    },
  });

  if (!knowledgeItem) {
    return null;
  }

  return prisma.knowledgeItemRelation.findMany({
    where: {
      fromKnowledgeItemId: knowledgeItem.id,
    },
    include: {
      toKnowledgeItem: {
        include: buildKnowledgeItemSummaryInclude(),
      },
    },
    orderBy: [{ relationType: "asc" }, { createdAt: "asc" }],
  });
}

export async function listKnowledgeItemMemoryHooks({
  knowledgeItemIdOrSlug,
  userId,
}: {
  knowledgeItemIdOrSlug: string;
  userId?: string;
}) {
  if (!userId) {
    return [];
  }

  const knowledgeItem = await prisma.knowledgeItem.findFirst({
    where: {
      OR: [{ id: knowledgeItemIdOrSlug }, { slug: knowledgeItemIdOrSlug }],
    },
    select: {
      id: true,
    },
  });

  if (!knowledgeItem) {
    return null;
  }

  return prisma.knowledgeItemMemoryHook.findMany({
    where: {
      knowledgeItemId: knowledgeItem.id,
      userId,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveUserKnowledgeItemMemoryHook({
  knowledgeItemIdOrSlug,
  userId,
  content,
}: {
  knowledgeItemIdOrSlug: string;
  userId: string;
  content: string;
}) {
  const knowledgeItem = await prisma.knowledgeItem.findFirst({
    where: {
      OR: [{ id: knowledgeItemIdOrSlug }, { slug: knowledgeItemIdOrSlug }],
    },
    select: {
      id: true,
    },
  });

  if (!knowledgeItem) {
    return null;
  }

  return prisma.knowledgeItemMemoryHook.upsert({
    where: {
      userId_knowledgeItemId: {
        userId,
        knowledgeItemId: knowledgeItem.id,
      },
    },
    create: {
      knowledgeItemId: knowledgeItem.id,
      userId,
      content,
    },
    update: {
      content,
    },
  });
}

export async function getKnowledgeItemMemoryHookById({
  hookId,
  userId,
}: {
  hookId: string;
  userId?: string;
}) {
  return prisma.knowledgeItemMemoryHook.findFirst({
    where: {
      id: hookId,
      ...(userId ? { userId } : {}),
    },
    include: {
      knowledgeItem: {
        select: {
          id: true,
          slug: true,
          title: true,
          domain: true,
        },
      },
    },
  });
}

export async function deleteUserKnowledgeItemMemoryHook({
  hookId,
  userId,
}: {
  hookId: string;
  userId: string;
}) {
  const hook = await prisma.knowledgeItemMemoryHook.findFirst({
    where: {
      id: hookId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!hook) {
    return null;
  }

  await prisma.knowledgeItemMemoryHook.delete({
    where: {
      id: hook.id,
    },
  });

  return hook;
}

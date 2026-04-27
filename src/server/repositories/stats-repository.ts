import { prisma } from "@/lib/db/prisma";

export async function getLatestCompletedStudySessionSummary({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  return prisma.studySession.findFirst({
    where: {
      userId,
      domain,
      status: "completed",
    },
    orderBy: {
      completedAt: "desc",
    },
    include: {
      reviewLogs: {
        include: {
          knowledgeItem: {
            select: {
              id: true,
              slug: true,
              title: true,
              domain: true,
              summary: true,
            },
          },
          memoryHookUsed: {
            select: {
              id: true,
              content: true,
            },
          },
        },
      },
    },
  });
}

export async function listRecentStudySessions({
  userId,
  domain,
  take = 60,
}: {
  userId: string;
  domain: string;
  take?: number;
}) {
  return prisma.studySession.findMany({
    where: {
      userId,
      domain,
    },
    orderBy: {
      startedAt: "desc",
    },
    take,
  });
}

export async function listReviewLogsForUser({
  userId,
  domain,
  take = 500,
}: {
  userId: string;
  domain: string;
  take?: number;
}) {
  return prisma.reviewLog.findMany({
    where: {
      userId,
      knowledgeItem: {
        domain,
      },
    },
    orderBy: {
      reviewedAt: "asc",
    },
    include: {
      reviewItem: {
        select: {
          type: true,
        },
      },
    },
    take,
  });
}

export async function listWeakKnowledgeItemStates({
  userId,
  domain,
  take = 8,
}: {
  userId: string;
  domain: string;
  take?: number;
}) {
  return prisma.userKnowledgeItemState.findMany({
    where: {
      userId,
      knowledgeItem: {
        domain,
      },
    },
    include: {
      knowledgeItem: {
        include: {
          _count: {
            select: {
              memoryHooks: true,
            },
          },
        },
      },
    },
    orderBy: [
      { nextReviewAt: "asc" },
      { memoryStrength: "asc" },
      { lapseCount: "desc" },
      { difficultyEstimate: "desc" },
    ],
    take,
  });
}

export async function countProgressBuckets({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  const now = new Date();
  const domainWhere = {
    knowledgeItem: {
      domain,
    },
  };

  const [
    trackedKnowledgeItemCount,
    dueNowCount,
    scheduledCount,
    stableCount,
    weakCount,
    memoryHookKnowledgeItemRows,
    latestDiagnostic,
  ] = await Promise.all([
    prisma.userKnowledgeItemState.count({
      where: {
        userId,
        ...domainWhere,
      },
    }),
    prisma.userKnowledgeItemState.count({
      where: {
        userId,
        ...domainWhere,
        nextReviewAt: {
          lte: now,
        },
      },
    }),
    prisma.userKnowledgeItemState.count({
      where: {
        userId,
        ...domainWhere,
        nextReviewAt: {
          gt: now,
        },
      },
    }),
    prisma.userKnowledgeItemState.count({
      where: {
        userId,
        ...domainWhere,
        memoryStrength: {
          gte: 0.7,
        },
        consecutiveCorrect: {
          gte: 3,
        },
      },
    }),
    prisma.userKnowledgeItemState.count({
      where: {
        userId,
        ...domainWhere,
        OR: [
          {
            memoryStrength: {
              lt: 0.4,
            },
          },
          {
            lapseCount: {
              gt: 0,
            },
          },
        ],
      },
    }),
    prisma.knowledgeItemMemoryHook.findMany({
      where: {
        userId,
        knowledgeItem: {
          domain,
        },
      },
      distinct: ["knowledgeItemId"],
      select: {
        knowledgeItemId: true,
      },
    }),
    prisma.diagnosticAttempt.findFirst({
      where: {
        userId,
        domain,
      },
      orderBy: {
        completedAt: "desc",
      },
      select: {
        completedAt: true,
      },
    }),
  ]);

  return {
    trackedKnowledgeItemCount,
    dueNowCount,
    scheduledCount,
    stableCount,
    weakCount,
    memoryHookKnowledgeItemCount: memoryHookKnowledgeItemRows.length,
    latestDiagnosticAt: latestDiagnostic?.completedAt ?? null,
  };
}

export async function listRecentMemoryHookActivity({
  userId,
  domain,
  from,
  knowledgeItemIds,
}: {
  userId: string;
  domain: string;
  from: Date;
  knowledgeItemIds: string[];
}) {
  const [createdHooks, usedHooks] = await Promise.all([
    prisma.knowledgeItemMemoryHook.findMany({
      where: {
        userId,
        knowledgeItem: {
          domain,
        },
        createdAt: {
          gte: from,
        },
      },
      include: {
        knowledgeItem: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    prisma.reviewLog.findMany({
      where: {
        userId,
        reviewedAt: {
          gte: from,
        },
        memoryHookUsedId: {
          not: null,
        },
        knowledgeItemId: {
          in: knowledgeItemIds,
        },
      },
      include: {
        knowledgeItem: {
          select: {
            id: true,
            title: true,
          },
        },
        memoryHookUsed: {
          select: {
            id: true,
            content: true,
          },
        },
      },
      orderBy: {
        reviewedAt: "desc",
      },
      take: 10,
    }),
  ]);

  return {
    createdHooks,
    usedHooks,
  };
}

export async function listAccessibleMemoryHooks({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  return prisma.knowledgeItemMemoryHook.findMany({
    where: {
      userId,
      knowledgeItem: {
        domain,
      },
    },
    select: {
      id: true,
    },
  });
}

export async function listProductEvents({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  return prisma.productEvent.findMany({
    where: {
      userId,
      OR: [
        {
          knowledgeItem: {
            domain,
          },
        },
        {
          studySession: {
            domain,
          },
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });
}

export async function createProductEvents({
  userId,
  events,
}: {
  userId: string;
  events: Array<{
    knowledgeItemId?: string;
    studySessionId?: string;
    type: "weak_item_impression" | "weak_item_opened";
  }>;
}) {
  if (events.length === 0) {
    return;
  }

  await prisma.productEvent.createMany({
    data: events.map((event) => ({
      userId,
      knowledgeItemId: event.knowledgeItemId,
      studySessionId: event.studySessionId,
      type: event.type,
    })),
  });
}

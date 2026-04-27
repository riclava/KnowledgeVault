import { prisma } from "@/lib/db/prisma";

export async function getUserKnowledgeItemState(userId: string, knowledgeItemId: string) {
  return prisma.userKnowledgeItemState.findUnique({
    where: {
      userId_knowledgeItemId: {
        userId,
        knowledgeItemId,
      },
    },
  });
}

export async function listDueKnowledgeItemStates({
  userId,
  domain,
  now,
  take,
}: {
  userId: string;
  domain: string;
  now: Date;
  take: number;
}) {
  return prisma.userKnowledgeItemState.findMany({
    where: {
      userId,
      nextReviewAt: {
        lte: now,
      },
      knowledgeItem: {
        domain,
      },
    },
    include: {
      knowledgeItem: {
        include: {
          reviewItems: {
            orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
          },
          memoryHooks: {
            where: {
              userId,
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ nextReviewAt: "asc" }, { updatedAt: "asc" }],
    take,
  });
}

export async function listWeakKnowledgeItemStatesForReview({
  userId,
  domain,
  take,
}: {
  userId: string;
  domain: string;
  take: number;
}) {
  return prisma.userKnowledgeItemState.findMany({
    where: {
      userId,
      knowledgeItem: {
        domain,
      },
      OR: [
        {
          memoryStrength: {
            lt: 0.55,
          },
        },
        {
          lapseCount: {
            gt: 0,
          },
        },
        {
          difficultyEstimate: {
            gte: 3,
          },
        },
      ],
    },
    include: {
      knowledgeItem: {
        include: {
          reviewItems: {
            orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
          },
          memoryHooks: {
            where: {
              userId,
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      { lapseCount: "desc" },
      { memoryStrength: "asc" },
      { difficultyEstimate: "desc" },
      { updatedAt: "desc" },
    ],
    take,
  });
}

export async function countUserKnowledgeItemStates({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  return prisma.userKnowledgeItemState.count({
    where: {
      userId,
      knowledgeItem: {
        domain,
      },
    },
  });
}

export async function createStudySession({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  return prisma.studySession.create({
    data: {
      userId,
      domain,
    },
  });
}

export async function getStudySessionById({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  return prisma.studySession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: {
      reviewLogs: true,
    },
  });
}

export async function createReviewLog({
  userId,
  knowledgeItemId,
  reviewItemId,
  studySessionId,
  result,
  responseTimeMs,
  memoryHookUsedId,
}: {
  userId: string;
  knowledgeItemId: string;
  reviewItemId: string;
  studySessionId: string;
  result: "again" | "hard" | "good" | "easy";
  responseTimeMs?: number;
  memoryHookUsedId?: string;
}) {
  return prisma.reviewLog.create({
    data: {
      userId,
      knowledgeItemId,
      reviewItemId,
      studySessionId,
      result,
      responseTimeMs,
      memoryHookUsedId,
    },
  });
}

export async function updateUserKnowledgeItemState({
  userId,
  knowledgeItemId,
  data,
}: {
  userId: string;
  knowledgeItemId: string;
  data: {
    memoryStrength: number;
    stability: number;
    difficultyEstimate: number;
    lastReviewedAt: Date;
    nextReviewAt: Date;
    totalReviews: number;
    correctReviews: number;
    lapseCount: number;
    consecutiveCorrect: number;
  };
}) {
  return prisma.userKnowledgeItemState.update({
    where: {
      userId_knowledgeItemId: {
        userId,
        knowledgeItemId,
      },
    },
    data,
  });
}

export async function completeStudySession(sessionId: string) {
  return prisma.studySession.update({
    where: {
      id: sessionId,
    },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });
}

export async function deferKnowledgeItemReview({
  userId,
  knowledgeItemId,
  nextReviewAt,
}: {
  userId: string;
  knowledgeItemId: string;
  nextReviewAt: Date;
}) {
  return prisma.userKnowledgeItemState.update({
    where: {
      userId_knowledgeItemId: {
        userId,
        knowledgeItemId,
      },
    },
    data: {
      nextReviewAt,
    },
  });
}

export async function getReviewHintSource({
  userId,
  knowledgeItemId,
}: {
  userId: string;
  knowledgeItemId: string;
}) {
  return prisma.userKnowledgeItemState.findUnique({
    where: {
      userId_knowledgeItemId: {
        userId,
        knowledgeItemId,
      },
    },
    include: {
      knowledgeItem: {
        include: {
          memoryHooks: {
            where: {
              userId,
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { buildKnowledgeItemVisibilityWhere } from "@/server/repositories/knowledge-item-visibility";

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
  take?: number;
}) {
  return prisma.userKnowledgeItemState.findMany({
    where: {
      userId,
      nextReviewAt: {
        lte: now,
      },
      knowledgeItem: {
        ...buildKnowledgeItemVisibilityWhere(userId),
        domain,
      },
    },
    include: {
      knowledgeItem: {
        include: {
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
    ...(typeof take === "number" ? { take } : {}),
  });
}

export async function listWeakKnowledgeItemStatesForReview({
  userId,
  domain,
  take,
}: {
  userId: string;
  domain: string;
  take?: number;
}) {
  return prisma.userKnowledgeItemState.findMany({
    where: {
      userId,
      knowledgeItem: {
        ...buildKnowledgeItemVisibilityWhere(userId),
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
    ...(typeof take === "number" ? { take } : {}),
  });
}

export async function ensureUnstartedKnowledgeItemStatesForReview({
  userId,
  domain,
  now,
}: {
  userId: string;
  domain: string;
  now: Date;
}) {
  const knowledgeItems = await prisma.knowledgeItem.findMany({
    where: {
      ...buildKnowledgeItemVisibilityWhere(userId),
      domain,
      questionBindings: {
        some: {
          question: {
            isActive: true,
          },
        },
      },
      userStates: {
        none: {
          userId,
        },
      },
    },
    select: {
      id: true,
      difficulty: true,
    },
  });

  if (knowledgeItems.length === 0) {
    return 0;
  }

  const result = await prisma.userKnowledgeItemState.createMany({
    data: knowledgeItems.map((knowledgeItem) => ({
      userId,
      knowledgeItemId: knowledgeItem.id,
      memoryStrength: 0.15,
      stability: 0,
      difficultyEstimate: knowledgeItem.difficulty,
      nextReviewAt: now,
    })),
    skipDuplicates: true,
  });

  return result.count;
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
        ...buildKnowledgeItemVisibilityWhere(userId),
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
      questionAttempts: true,
    },
  });
}

export async function getActiveQuestionForKnowledgeItem({
  questionId,
  knowledgeItemId,
  userId,
}: {
  questionId: string;
  knowledgeItemId: string;
  userId?: string;
}) {
  return prisma.question.findFirst({
    where: {
      isActive: true,
      id: questionId,
      knowledgeItems: {
        some: {
          knowledgeItemId,
          knowledgeItem: buildKnowledgeItemVisibilityWhere(userId),
        },
      },
    },
    include: {
      knowledgeItems: {
        where: {
          knowledgeItemId,
        },
        include: {
          knowledgeItem: true,
        },
      },
    },
  });
}

export async function createQuestionAttempt({
  userId,
  questionId,
  studySessionId,
  result,
  score,
  feedback,
  submittedAnswer,
  responseTimeMs,
}: {
  userId: string;
  questionId: string;
  studySessionId: string;
  result: "correct" | "partial" | "incorrect";
  score: number;
  feedback?: string;
  submittedAnswer: Prisma.InputJsonValue;
  responseTimeMs?: number;
}) {
  return prisma.questionAttempt.create({
    data: {
      userId,
      questionId,
      studySessionId,
      result,
      score,
      feedback,
      submittedAnswer,
      responseTimeMs,
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
            take: 1,
          },
        },
      },
    },
  });
}

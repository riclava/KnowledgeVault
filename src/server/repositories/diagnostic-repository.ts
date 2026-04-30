import { prisma } from "@/lib/db/prisma";
import { buildKnowledgeItemVisibilityWhere } from "@/server/repositories/knowledge-item-visibility";
import type { DiagnosticAssessment } from "@/types/diagnostic";

function buildDiagnosticQuestionInclude({
  domain,
  userId,
}: {
  domain: string;
  userId?: string;
}) {
  return {
    knowledgeItems: {
      where: {
        knowledgeItem: {
          ...buildKnowledgeItemVisibilityWhere(userId),
          domain,
        },
      },
      include: {
        knowledgeItem: {
          include: {
            _count: {
              select: {
                questionBindings: {
                  where: {
                    question: {
                      isActive: true,
                    },
                  },
                },
                memoryHooks: true,
              },
            },
          },
        },
      },
    },
  } as const;
}

export async function listDiagnosticQuestions({
  domain,
  userId,
  take,
}: {
  domain: string;
  userId?: string;
  take: number;
}) {
  return prisma.question.findMany({
    where: {
      isActive: true,
      knowledgeItems: {
        some: {
          knowledgeItem: {
            ...buildKnowledgeItemVisibilityWhere(userId),
            domain,
          },
        },
      },
    },
    include: buildDiagnosticQuestionInclude({ domain, userId }),
    orderBy: [
      {
        difficulty: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    take,
  });
}

export async function listQuestionsByIds({
  domain,
  questionIds,
  userId,
}: {
  domain: string;
  questionIds: string[];
  userId?: string;
}) {
  return prisma.question.findMany({
    where: {
      id: {
        in: questionIds,
      },
      isActive: true,
      knowledgeItems: {
        some: {
          knowledgeItem: {
            ...buildKnowledgeItemVisibilityWhere(userId),
            domain,
          },
        },
      },
    },
    include: buildDiagnosticQuestionInclude({ domain, userId }),
  });
}

export async function createDiagnosticAttempt({
  userId,
  domain,
  questionIds,
  weakKnowledgeItemIds,
}: {
  userId: string;
  domain: string;
  questionIds: string[];
  weakKnowledgeItemIds: string[];
}) {
  return prisma.diagnosticAttempt.create({
    data: {
      userId,
      domain,
      questionIds,
      weakKnowledgeItemIds,
    },
  });
}

export async function upsertDiagnosticKnowledgeItemStates({
  userId,
  knowledgeItemIds,
  weakKnowledgeItemIds,
  assessmentsByKnowledgeItemId,
}: {
  userId: string;
  knowledgeItemIds: string[];
  weakKnowledgeItemIds: string[];
  assessmentsByKnowledgeItemId: Map<string, DiagnosticAssessment>;
}) {
  const weakKnowledgeItemIdSet = new Set(weakKnowledgeItemIds);
  const now = new Date();
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  await prisma.$transaction(
    knowledgeItemIds.map((knowledgeItemId) => {
      const assessment = assessmentsByKnowledgeItemId.get(knowledgeItemId) ?? "none";
      const isWeak = weakKnowledgeItemIdSet.has(knowledgeItemId);

      return prisma.userKnowledgeItemState.upsert({
        where: {
          userId_knowledgeItemId: {
            userId,
            knowledgeItemId,
          },
        },
        create: {
          userId,
          knowledgeItemId,
          memoryStrength: assessment === "clear" ? 0.7 : assessment === "partial" ? 0.35 : 0.05,
          stability: assessment === "clear" ? 3 : assessment === "partial" ? 1 : 0,
          difficultyEstimate: assessment === "clear" ? 1 : assessment === "partial" ? 2 : 3,
          nextReviewAt: isWeak ? now : threeDaysLater,
        },
        update: {
          memoryStrength: assessment === "clear" ? 0.7 : assessment === "partial" ? 0.35 : 0.05,
          stability: assessment === "clear" ? 3 : assessment === "partial" ? 1 : 0,
          difficultyEstimate: assessment === "clear" ? 1 : assessment === "partial" ? 2 : 3,
          nextReviewAt: isWeak ? now : threeDaysLater,
        },
      });
    }),
  );
}

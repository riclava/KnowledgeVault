import { prisma } from "@/lib/db/prisma";
import type { DiagnosticAssessment } from "@/types/diagnostic";

const diagnosticQuestionInclude = {
  knowledgeItem: {
    include: {
      _count: {
        select: {
          reviewItems: true,
          memoryHooks: true,
        },
      },
    },
  },
} as const;

export async function listDiagnosticReviewItems({
  domain,
  take,
}: {
  domain: string;
  take: number;
}) {
  return prisma.reviewItem.findMany({
    where: {
      knowledgeItem: {
        domain,
      },
    },
    include: diagnosticQuestionInclude,
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

export async function listReviewItemsByIds({
  domain,
  reviewItemIds,
}: {
  domain: string;
  reviewItemIds: string[];
}) {
  return prisma.reviewItem.findMany({
    where: {
      id: {
        in: reviewItemIds,
      },
      knowledgeItem: {
        domain,
      },
    },
    include: {
      knowledgeItem: true,
    },
  });
}

export async function createDiagnosticAttempt({
  userId,
  domain,
  reviewItemIds,
  weakKnowledgeItemIds,
}: {
  userId: string;
  domain: string;
  reviewItemIds: string[];
  weakKnowledgeItemIds: string[];
}) {
  return prisma.diagnosticAttempt.create({
    data: {
      userId,
      domain,
      reviewItemIds,
      weakKnowledgeItemIds,
    },
  });
}

export async function getLatestDiagnosticAttempt({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  return prisma.diagnosticAttempt.findFirst({
    where: {
      userId,
      domain,
    },
    orderBy: {
      completedAt: "desc",
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

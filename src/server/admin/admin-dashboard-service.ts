import { prisma } from "@/lib/db/prisma";

export async function getAdminDashboard() {
  const [
    knowledgeItemCount,
    questionCount,
    relationCount,
    variableCount,
    recentImportRuns,
  ] = await Promise.all([
    prisma.knowledgeItem.count(),
    prisma.question.count({
      where: {
        isActive: true,
      },
    }),
    prisma.knowledgeItemRelation.count(),
    prisma.questionKnowledgeItem.count(),
    prisma.adminImportRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    knowledgeItemCount,
    questionCount,
    relationCount,
    variableCount,
    recentImportRuns,
  };
}

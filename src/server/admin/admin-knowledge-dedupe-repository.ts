import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { KnowledgeDedupeGroup } from "@/server/admin/knowledge-dedupe-similarity";

const RUN_SELECT = {
  id: true,
  status: true,
  candidateCount: true,
} satisfies Prisma.KnowledgeDedupeRunSelect;

export function createKnowledgeDedupeRun({
  adminUserId,
  domain,
  subdomain,
  threshold,
  usedAiReview,
}: {
  adminUserId: string;
  domain: string;
  subdomain?: string;
  threshold: number;
  usedAiReview: boolean;
}) {
  return prisma.knowledgeDedupeRun.create({
    data: {
      adminUserId,
      domain,
      subdomain: subdomain ?? null,
      threshold,
      usedAiReview,
    },
    select: { id: true },
  });
}

export function completeKnowledgeDedupeRun({
  id,
  candidateCount,
  warningMessage,
}: {
  id: string;
  candidateCount: number;
  warningMessage?: string;
}) {
  return prisma.knowledgeDedupeRun.update({
    where: { id },
    data: {
      status: "completed",
      candidateCount,
      warningMessage: warningMessage ?? null,
      completedAt: new Date(),
    },
    select: RUN_SELECT,
  });
}

export function failKnowledgeDedupeRun({
  id,
  errorMessage,
}: {
  id: string;
  errorMessage: string;
}) {
  return prisma.knowledgeDedupeRun.update({
    where: { id },
    data: {
      status: "failed",
      errorMessage,
      completedAt: new Date(),
    },
    select: RUN_SELECT,
  });
}

export function listKnowledgeDedupeRuns(limit = 10) {
  return prisma.knowledgeDedupeRun.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { candidates: true },
      },
    },
  });
}

export function getKnowledgeDedupeRun(id: string) {
  return prisma.knowledgeDedupeRun.findUnique({
    where: { id },
    include: {
      candidates: {
        orderBy: [{ status: "asc" }, { localScore: "desc" }],
      },
    },
  });
}

export async function createKnowledgeDedupeCandidates({
  runId,
  groups,
  warningMessage,
}: {
  runId: string;
  groups: KnowledgeDedupeGroup[];
  warningMessage?: string;
}) {
  if (groups.length === 0) {
    return { count: 0 };
  }

  return prisma.knowledgeDedupeCandidate.createMany({
    data: groups.map((group) => ({
      runId,
      knowledgeItemIds: group.itemIds,
      localScore: group.score,
      localReasons: group.reasons,
      warningMessage: warningMessage ?? null,
      suggestedCanonicalItemId: group.itemIds[0] ?? null,
    })),
  });
}

export function ignoreKnowledgeDedupeCandidate(id: string, reason?: string) {
  return prisma.knowledgeDedupeCandidate.update({
    where: { id },
    data: {
      status: "ignored",
      ignoredReason: reason ?? null,
    },
  });
}

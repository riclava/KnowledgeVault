import { prisma } from "@/lib/db/prisma";
import {
  completeKnowledgeDedupeRun,
  createKnowledgeDedupeCandidates,
  createKnowledgeDedupeRun,
  failKnowledgeDedupeRun,
  getKnowledgeDedupeRun,
  ignoreKnowledgeDedupeCandidate,
  listKnowledgeDedupeRuns,
} from "@/server/admin/admin-knowledge-dedupe-repository";
import {
  clusterKnowledgeDedupePairs,
  findKnowledgeDedupePairs,
  type KnowledgeDedupeScoredItem,
} from "@/server/admin/knowledge-dedupe-similarity";

const DEFAULT_THRESHOLD = 0.55;
const AI_REVIEW_WARNING = "AI 复核暂未接入，本次仅使用本地相似度规则。";

export type KnowledgeDedupeScanInput = {
  domain: string;
  subdomain?: string;
  threshold: number;
  useAiReview: boolean;
};

export function normalizeKnowledgeDedupeScanInput(
  input: unknown,
): KnowledgeDedupeScanInput {
  const record = isRecord(input) ? input : {};
  const domain = text(record.domain);
  const subdomain = text(record.subdomain);
  const threshold = normalizeThreshold(record.threshold);

  if (!domain) {
    throw new Error("领域不能为空。");
  }

  return {
    domain,
    ...(subdomain ? { subdomain } : {}),
    threshold,
    useAiReview: record.useAiReview === true,
  };
}

export async function createKnowledgeDedupeRunForAdmin({
  adminUserId,
  input,
}: {
  adminUserId: string;
  input: unknown;
}) {
  const scanInput = normalizeKnowledgeDedupeScanInput(input);
  const run = await createKnowledgeDedupeRun({
    adminUserId,
    domain: scanInput.domain,
    subdomain: scanInput.subdomain,
    threshold: scanInput.threshold,
    usedAiReview: scanInput.useAiReview,
  });
  const warningMessage = scanInput.useAiReview ? AI_REVIEW_WARNING : undefined;

  try {
    const items = await listPublicKnowledgeItemsForDedupe(scanInput);
    const pairs = findKnowledgeDedupePairs(items, scanInput.threshold);
    const groups = clusterKnowledgeDedupePairs(pairs);

    await createKnowledgeDedupeCandidates({
      runId: run.id,
      groups,
      warningMessage,
    });

    return completeKnowledgeDedupeRun({
      id: run.id,
      candidateCount: groups.length,
      warningMessage,
    });
  } catch (error) {
    return failKnowledgeDedupeRun({
      id: run.id,
      errorMessage: error instanceof Error ? error.message : "去重扫描失败。",
    });
  }
}

export function listKnowledgeDedupeRunsForAdmin() {
  return listKnowledgeDedupeRuns();
}

export function getKnowledgeDedupeRunForAdmin(id: string) {
  return getKnowledgeDedupeRun(id);
}

export async function getKnowledgeDedupeRunDetailForAdmin(id: string) {
  const run = await getKnowledgeDedupeRun(id);

  if (!run) {
    return null;
  }

  const itemIds = unique(
    run.candidates.flatMap((candidate) => candidate.knowledgeItemIds),
  );
  const items = itemIds.length > 0
    ? await prisma.knowledgeItem.findMany({
        where: { id: { in: itemIds } },
        select: {
          id: true,
          title: true,
          slug: true,
          contentType: true,
          domain: true,
          subdomain: true,
          summary: true,
          difficulty: true,
          updatedAt: true,
          _count: {
            select: {
              questionBindings: {
                where: {
                  question: { isActive: true },
                },
              },
              outgoingRelations: true,
              userStates: true,
              memoryHooks: true,
            },
          },
        },
      })
    : [];

  return { run, items };
}

export function ignoreKnowledgeDedupeCandidateForAdmin({
  id,
  input,
}: {
  id: string;
  input: unknown;
}) {
  const record = isRecord(input) ? input : {};

  return ignoreKnowledgeDedupeCandidate(id, text(record.reason) || undefined);
}

async function listPublicKnowledgeItemsForDedupe(
  input: KnowledgeDedupeScanInput,
): Promise<KnowledgeDedupeScoredItem[]> {
  return prisma.knowledgeItem.findMany({
    where: {
      visibility: "public",
      domain: input.domain,
      ...(input.subdomain ? { subdomain: input.subdomain } : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      body: true,
      contentType: true,
      tags: true,
    },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
  });
}

function normalizeThreshold(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_THRESHOLD;
  }

  const threshold = Number(value);

  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error("阈值必须在 0 到 1 之间。");
  }

  return threshold;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

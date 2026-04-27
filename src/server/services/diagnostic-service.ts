import {
  createDiagnosticAttempt,
  getLatestDiagnosticAttempt,
  listDiagnosticReviewItems,
  listReviewItemsByIds,
  upsertDiagnosticKnowledgeItemStates,
} from "@/server/repositories/diagnostic-repository";
import {
  calculateBestDiagnosticAssessmentsByKnowledgeItem,
  calculateDiagnosticWeakKnowledgeItemIds,
} from "@/server/services/diagnostic-rules";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import { getKnowledgeItemSummaries } from "@/server/services/knowledge-item-service";
import type {
  DiagnosticResult,
  DiagnosticStart,
  DiagnosticSubmission,
} from "@/types/diagnostic";
import type { KnowledgeItemSummary } from "@/types/knowledge-item";
import type { KnowledgeItemType } from "@/types/knowledge-item";

const DEFAULT_DIAGNOSTIC_DOMAIN = "概率统计";
const DIAGNOSTIC_QUESTION_COUNT = 5;

export async function startDiagnostic({
  domain = DEFAULT_DIAGNOSTIC_DOMAIN,
}: {
  domain?: string;
} = {}): Promise<DiagnosticStart> {
  const reviewItems = await listDiagnosticReviewItems({
    domain,
    take: DIAGNOSTIC_QUESTION_COUNT,
  });

  return {
    domain,
    questions: reviewItems.map((item) => ({
      id: item.id,
      knowledgeItemId: item.knowledgeItemId,
      type: item.type,
      prompt: item.prompt,
      answer: item.answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      knowledgeItem: toKnowledgeItemSummary(item.knowledgeItem),
    })),
  };
}

export async function submitDiagnostic({
  userId,
  submission,
}: {
  userId: string;
  submission: DiagnosticSubmission;
}): Promise<DiagnosticResult> {
  const reviewItemIds = submission.answers.map((answer) => answer.reviewItemId);
  const reviewItems = await listReviewItemsByIds({
    domain: submission.domain,
    reviewItemIds,
  });
  const knowledgeItemIds = Array.from(
    new Set(reviewItems.map((item) => item.knowledgeItemId)),
  );
  const weakKnowledgeItemIds = calculateDiagnosticWeakKnowledgeItemIds({
    reviewItems,
    answers: submission.answers,
  });
  const assessmentsByKnowledgeItemId = calculateBestDiagnosticAssessmentsByKnowledgeItem({
    reviewItems,
    answers: submission.answers,
  });

  await upsertDiagnosticKnowledgeItemStates({
    userId,
    knowledgeItemIds,
    weakKnowledgeItemIds,
    assessmentsByKnowledgeItemId,
  });

  const attempt = await createDiagnosticAttempt({
    userId,
    domain: submission.domain,
    reviewItemIds,
    weakKnowledgeItemIds,
  });

  const weakKnowledgeItems = await getWeakKnowledgeItemSummaries(weakKnowledgeItemIds);

  return {
    id: attempt.id,
    domain: attempt.domain,
    reviewItemIds: attempt.reviewItemIds,
    weakKnowledgeItemIds: attempt.weakKnowledgeItemIds,
    completedAt: attempt.completedAt.toISOString(),
    weakKnowledgeItems,
    reviewQueueKnowledgeItemIds: weakKnowledgeItemIds.length > 0 ? weakKnowledgeItemIds : knowledgeItemIds,
  };
}

export async function getLatestDiagnosticResult({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}): Promise<DiagnosticResult | null> {
  const attempt = await getLatestDiagnosticAttempt({
    userId,
    domain,
  });

  if (!attempt) {
    return null;
  }

  const weakKnowledgeItems = await getWeakKnowledgeItemSummaries(attempt.weakKnowledgeItemIds);

  return {
    id: attempt.id,
    domain: attempt.domain,
    reviewItemIds: attempt.reviewItemIds,
    weakKnowledgeItemIds: attempt.weakKnowledgeItemIds,
    completedAt: attempt.completedAt.toISOString(),
    weakKnowledgeItems,
    reviewQueueKnowledgeItemIds: attempt.weakKnowledgeItemIds,
  };
}

async function getWeakKnowledgeItemSummaries(knowledgeItemIds: string[]) {
  if (knowledgeItemIds.length === 0) {
    return [];
  }

  const summaries = await getKnowledgeItemSummaries();
  const knowledgeItemIdSet = new Set(knowledgeItemIds);

  return summaries.filter((knowledgeItem) => knowledgeItemIdSet.has(knowledgeItem.id));
}

function toKnowledgeItemSummary(knowledgeItem: {
  id: string;
  slug: string;
  title: string;
  contentType: KnowledgeItemType;
  renderPayload: unknown;
  domain: string;
  subdomain: string | null;
  summary: string;
  difficulty: number;
  tags: string[];
  variables?: Array<{
    symbol: string;
    name: string;
  }>;
  _count: {
    reviewItems: number;
    memoryHooks: number;
  };
}): KnowledgeItemSummary {
  return {
    id: knowledgeItem.id,
    slug: knowledgeItem.slug,
    title: knowledgeItem.title,
    contentType: knowledgeItem.contentType,
    renderPayload: normalizeKnowledgeItemRenderPayload(
      knowledgeItem.contentType,
      knowledgeItem.renderPayload,
    ),
    domain: knowledgeItem.domain,
    subdomain: knowledgeItem.subdomain,
    summary: knowledgeItem.summary,
    difficulty: knowledgeItem.difficulty,
    tags: knowledgeItem.tags,
    variablePreview: knowledgeItem.variables ?? [],
    reviewItemCount: knowledgeItem._count.reviewItems,
    memoryHookCount: knowledgeItem._count.memoryHooks,
    trainingStatus: "not_started",
    trainingStatusLabel: "尚未进入训练",
    nextReviewAt: null,
    isWeak: false,
    isDueNow: false,
    hasPersonalMemoryHook: false,
    totalReviews: 0,
    correctReviews: 0,
  };
}

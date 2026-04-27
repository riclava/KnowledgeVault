import {
  deleteUserKnowledgeItemMemoryHook,
  getKnowledgeItemByIdOrSlug,
  listKnowledgeItemRelations,
  listKnowledgeItemDomains,
  listKnowledgeItemMemoryHooks,
  listKnowledgeItems,
  saveUserKnowledgeItemMemoryHook,
} from "@/server/repositories/knowledge-item-repository";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import type {
  KnowledgeItemDetail,
  KnowledgeItemRelationDetail,
  KnowledgeItemSummary,
  KnowledgeItemType,
} from "@/types/knowledge-item";
import type { MemoryHookRecord } from "@/types/memory-hook";

type KnowledgeItemWithDetail = NonNullable<Awaited<ReturnType<typeof getKnowledgeItemByIdOrSlug>>>;
type RelationWithKnowledgeItem = NonNullable<
  Awaited<ReturnType<typeof listKnowledgeItemRelations>>
>[number];

export async function getKnowledgeItemSummaries(params?: {
  domain?: string;
  tag?: string;
  difficulty?: number;
  query?: string;
  userId?: string;
}): Promise<KnowledgeItemSummary[]> {
  const knowledgeItems = await listKnowledgeItems(params);
  const now = new Date();

  return knowledgeItems
    .map((knowledgeItem) => toKnowledgeItemSummary(knowledgeItem, now))
    .sort((left, right) => {
      const leftPriority = getTrainingStatusPriority(left.trainingStatus);
      const rightPriority = getTrainingStatusPriority(right.trainingStatus);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      if (left.domain !== right.domain) {
        return left.domain.localeCompare(right.domain, "zh-CN");
      }

      if (left.difficulty !== right.difficulty) {
        return left.difficulty - right.difficulty;
      }

      return left.title.localeCompare(right.title, "zh-CN");
    });
}

export async function getKnowledgeItemDomains() {
  return listKnowledgeItemDomains();
}

export async function getKnowledgeItemDetail(
  idOrSlug: string,
): Promise<KnowledgeItemDetail | null> {
  const knowledgeItem = await getKnowledgeItemByIdOrSlug(idOrSlug);

  if (!knowledgeItem) {
    return null;
  }

  return toKnowledgeItemDetail(knowledgeItem, new Date());
}

export async function getKnowledgeItemRelationDetails(
  idOrSlug: string,
): Promise<KnowledgeItemRelationDetail[] | null> {
  const relations = await listKnowledgeItemRelations(idOrSlug);

  if (!relations) {
    return null;
  }

  return relations.map((relation) => toKnowledgeItemRelationDetail(relation, new Date()));
}

export async function getKnowledgeItemMemoryHooks({
  knowledgeItemIdOrSlug,
  userId,
}: {
  knowledgeItemIdOrSlug: string;
  userId?: string;
}) {
  const hooks = await listKnowledgeItemMemoryHooks({
    knowledgeItemIdOrSlug,
    userId,
  });

  if (!hooks) {
    return null;
  }

  return hooks.map(toMemoryHookRecord);
}

export async function saveKnowledgeItemMemoryHook({
  knowledgeItemIdOrSlug,
  userId,
  content,
}: {
  knowledgeItemIdOrSlug: string;
  userId: string;
  content: string;
}) {
  const hook = await saveUserKnowledgeItemMemoryHook({
    knowledgeItemIdOrSlug,
    userId,
    content,
  });

  if (!hook) {
    return null;
  }

  return toMemoryHookRecord(hook);
}

export async function removeMemoryHook({
  hookId,
  userId,
}: {
  hookId: string;
  userId: string;
}) {
  return deleteUserKnowledgeItemMemoryHook({
    hookId,
    userId,
  });
}

function toKnowledgeItemSummary(
  knowledgeItem: {
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
    variables: Array<{
      symbol: string;
      name: string;
    }>;
    memoryHooks: Array<{
      id: string;
    }>;
    userStates?: Array<{
      nextReviewAt: Date | null;
      memoryStrength: number;
      lapseCount: number;
      consecutiveCorrect: number;
      totalReviews: number;
      correctReviews: number;
    }>;
    _count: {
      reviewItems: number;
      memoryHooks: number;
    };
  },
  now: Date,
): KnowledgeItemSummary {
  const state = knowledgeItem.userStates?.[0];
  const hasPersonalMemoryHook = knowledgeItem.memoryHooks.length > 0;
  const isWeak =
    state !== undefined &&
    (state.memoryStrength < 0.4 || state.lapseCount > 0);
  const isDueNow =
    state?.nextReviewAt !== null &&
    state?.nextReviewAt !== undefined &&
    state.nextReviewAt.getTime() <= now.getTime();
  const isStable =
    state !== undefined &&
    state.memoryStrength >= 0.7 &&
    state.consecutiveCorrect >= 3;
  const trainingStatus = state
    ? isWeak
      ? "weak"
      : isDueNow
        ? "due_now"
        : isStable
          ? "stable"
          : state.totalReviews > 0 && state.nextReviewAt
            ? "scheduled"
            : "learning"
    : "not_started";

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
    variablePreview: knowledgeItem.variables.map((variable) => ({
      symbol: variable.symbol,
      name: variable.name,
    })),
    reviewItemCount: knowledgeItem._count.reviewItems,
    memoryHookCount: knowledgeItem.memoryHooks.length,
    trainingStatus,
    trainingStatusLabel: getTrainingStatusLabel(trainingStatus),
    nextReviewAt: state?.nextReviewAt?.toISOString() ?? null,
    isWeak,
    isDueNow,
    hasPersonalMemoryHook,
    totalReviews: state?.totalReviews ?? 0,
    correctReviews: state?.correctReviews ?? 0,
  };
}

function toKnowledgeItemDetail(knowledgeItem: KnowledgeItemWithDetail, now: Date): KnowledgeItemDetail {
  return {
    ...toKnowledgeItemSummary(knowledgeItem, now),
    body: knowledgeItem.body,
    intuition: knowledgeItem.intuition,
    deepDive: knowledgeItem.deepDive,
    useConditions: knowledgeItem.useConditions,
    nonUseConditions: knowledgeItem.nonUseConditions,
    antiPatterns: knowledgeItem.antiPatterns,
    typicalProblems: knowledgeItem.typicalProblems,
    examples: knowledgeItem.examples,
    variables: knowledgeItem.variables.map((variable) => ({
      id: variable.id,
      symbol: variable.symbol,
      name: variable.name,
      description: variable.description,
      unit: variable.unit,
      sortOrder: variable.sortOrder,
    })),
    reviewItems: knowledgeItem.reviewItems.map((item) => ({
      id: item.id,
      type: item.type,
      prompt: item.prompt,
      answer: item.answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
    })),
    memoryHooks: knowledgeItem.memoryHooks.map((hook) => toMemoryHookRecord(hook)),
  };
}

function toKnowledgeItemRelationDetail(
  relation: RelationWithKnowledgeItem,
  now: Date,
): KnowledgeItemRelationDetail {
  return {
    id: relation.id,
    relationType: relation.relationType,
    note: relation.note,
    knowledgeItem: toKnowledgeItemSummary(relation.toKnowledgeItem, now),
  };
}

function toMemoryHookRecord(hook: {
  id: string;
  content: string;
  updatedAt: Date | string;
}): MemoryHookRecord {
  return {
    id: hook.id,
    content: hook.content,
    updatedAt:
      hook.updatedAt instanceof Date ? hook.updatedAt.toISOString() : hook.updatedAt,
  };
}

function getTrainingStatusPriority(status: KnowledgeItemSummary["trainingStatus"]) {
  switch (status) {
    case "weak":
      return 0;
    case "due_now":
      return 1;
    case "learning":
      return 2;
    case "not_started":
      return 3;
    case "scheduled":
      return 4;
    case "stable":
      return 5;
    default:
      return 6;
  }
}

function getTrainingStatusLabel(status: KnowledgeItemSummary["trainingStatus"]) {
  switch (status) {
    case "weak":
      return "需要补弱";
    case "due_now":
      return "今天该复习";
    case "learning":
      return "正在建立";
    case "scheduled":
      return "已安排复习";
    case "stable":
      return "稳定中";
    case "not_started":
    default:
      return "尚未进入训练";
  }
}

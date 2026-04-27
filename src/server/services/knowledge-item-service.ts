import {
  createCustomKnowledgeItem,
  deleteUserKnowledgeItemMemoryHook,
  getKnowledgeItemByIdOrSlug,
  listKnowledgeItemRelations,
  listKnowledgeItemCatalogFacets,
  listKnowledgeItemDomains,
  listKnowledgeItemMemoryHooks,
  listKnowledgeItems,
  saveUserKnowledgeItemMemoryHook,
} from "@/server/repositories/knowledge-item-repository";
import {
  knowledgeItemRenderPayloadToText,
  normalizeKnowledgeItemRenderPayload,
  parseKnowledgeItemType,
} from "@/lib/knowledge-item-render-payload";
import type {
  KnowledgeItemCatalog,
  KnowledgeItemDetail,
  KnowledgeItemRenderPayloadByType,
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

export async function getKnowledgeItemCatalog(params?: {
  domain?: string;
  tag?: string;
  difficulty?: number;
  query?: string;
  userId?: string;
}): Promise<KnowledgeItemCatalog> {
  const [knowledgeItems, facetSource] = await Promise.all([
    getKnowledgeItemSummaries(params),
    listKnowledgeItemCatalogFacets(),
  ]);

  const tagFrequency = new Map<string, number>();

  for (const knowledgeItem of facetSource) {
    for (const tag of knowledgeItem.tags) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }
  }

  return {
    knowledgeItems,
    filters: {
      domains: Array.from(new Set(facetSource.map((knowledgeItem) => knowledgeItem.domain))),
      contentTypes: Array.from(
        new Set(facetSource.map((knowledgeItem) => knowledgeItem.contentType)),
      ),
      difficulties: Array.from(
        new Set(facetSource.map((knowledgeItem) => knowledgeItem.difficulty)),
      ).sort((left, right) => left - right),
      tags: Array.from(tagFrequency.entries())
        .sort((left, right) => {
          if (right[1] !== left[1]) {
            return right[1] - left[1];
          }

          return left[0].localeCompare(right[0], "zh-CN");
        })
        .map(([tag]) => tag),
    },
  };
}

export async function getKnowledgeItemDomains() {
  return listKnowledgeItemDomains();
}

export async function addCustomKnowledgeItem({
  userId,
  input,
}: {
  userId: string;
  input: {
    title: string;
    contentType?: string;
    renderPayload: unknown;
    domain?: string;
    subdomain?: string;
    summary: string;
    body?: string;
    derivation?: string;
    useConditions?: string[];
    nonUseConditions?: string[];
    antiPatterns?: string[];
    typicalProblems?: string[];
    examples?: string[];
    difficulty?: number;
    tags?: string[];
    memoryHook?: string;
  };
}) {
  const title = input.title.trim();
  const summary = input.summary.trim();
  const contentType = parseKnowledgeItemType(input.contentType) ?? "math_formula";
  const renderPayload = normalizeKnowledgeItemRenderPayload(
    contentType,
    input.renderPayload,
  );

  if (!title || !summary) {
    throw new Error("title and summary are required");
  }

  const domain = input.domain?.trim() || "自定义知识项";
  const slug = await createUniqueKnowledgeItemSlug(title);
  const difficulty = clampInteger(input.difficulty ?? 2, 1, 5);
  const body = input.body?.trim() || summary;
  const useConditions = normalizeTextList(input.useConditions, [
    "题目中的条件与公式变量可以一一对应。",
  ]);
  const nonUseConditions = normalizeTextList(input.nonUseConditions, [
    "变量含义或前提条件无法确认时不要直接套用。",
  ]);
  const antiPatterns = normalizeTextList(input.antiPatterns, [
    "只记表达式但没有确认适用条件。",
  ]);
  const typicalProblems = normalizeTextList(input.typicalProblems, [
    `${title} 的基础识别和代入题。`,
  ]);
  const examples = normalizeTextList(input.examples, [
    `看到题目要求“${summary}”时，先判断是否可以使用 ${title}。`,
  ]);
  const tags = normalizeTextList(input.tags, ["custom"]);
  const reviewItems = [
    {
      type: "recall" as const,
      prompt: recallPromptForKnowledgeItem(contentType, title),
      answer: answerForRenderPayload(contentType, renderPayload),
      explanation: summary,
      difficulty,
    },
    {
      type: "recognition" as const,
      prompt: `题目要求“${summary}”时，应优先想到哪个知识项？`,
      answer: title,
      explanation: `这是 ${title} 的典型使用场景。`,
      difficulty,
    },
    {
      type: "application" as const,
      prompt: examples[0],
      answer: `先确认适用条件，再使用 ${title}。`,
      explanation: body,
      difficulty: Math.min(5, difficulty + 1),
    },
  ];

  const knowledgeItem = await createCustomKnowledgeItem({
    userId,
    input: {
      slug,
      title,
      contentType,
      renderPayload,
      domain,
      subdomain: input.subdomain?.trim() || null,
      summary,
      body,
      derivation: input.derivation?.trim() || null,
      useConditions,
      nonUseConditions,
      antiPatterns,
      typicalProblems,
      examples,
      difficulty,
      tags,
      reviewItems,
      memoryHooks: input.memoryHook?.trim()
        ? [
            {
              content: input.memoryHook.trim(),
            },
          ]
        : [],
    },
  });

  return getKnowledgeItemDetail(knowledgeItem.slug);
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
    derivation: knowledgeItem.derivation,
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

async function createUniqueKnowledgeItemSlug(title: string) {
  const baseSlug =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "custom-knowledge-item";
  let candidate = baseSlug;
  let index = 1;

  while (await getKnowledgeItemByIdOrSlug(candidate)) {
    index += 1;
    candidate = `${baseSlug}-${index}`;
  }

  return candidate;
}

function recallPromptForKnowledgeItem(
  contentType: KnowledgeItemType,
  title: string,
) {
  if (contentType === "vocabulary") {
    return `回忆「${title}」的释义。`;
  }

  if (contentType === "plain_text") {
    return `回忆「${title}」的核心内容。`;
  }

  return `写出「${title}」的公式表达式。`;
}

function answerForRenderPayload(
  contentType: KnowledgeItemType,
  payload: KnowledgeItemRenderPayloadByType[KnowledgeItemType],
) {
  return knowledgeItemRenderPayloadToText(contentType, payload);
}

function normalizeTextList(value: string[] | undefined, fallback: string[]) {
  const items = value
    ?.flatMap((item) => item.split("\n"))
    .map((item) => item.trim())
    .filter(Boolean);

  return items && items.length > 0 ? items : fallback;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

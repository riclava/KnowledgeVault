import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { knowledgeItemRenderPayloadToText } from "@/lib/knowledge-item-render-payload";
import { getKnowledgeItemDetail, getKnowledgeItemRelationDetails, getKnowledgeItemSummaries } from "@/server/services/knowledge-item-service";
import type { KnowledgeItemDetail, KnowledgeItemRelationDetail } from "@/types/knowledge-item";
import type {
  ContentAssistDraft,
  ContentAssistRelationDraft,
  ContentAssistReviewItemDraft,
  ContentAssistWorkspaceItem,
} from "@/types/content-assist";

const CONTENT_ASSIST_ROOT = path.join(process.cwd(), "content-assist");
const DRAFTS_DIR = path.join(CONTENT_ASSIST_ROOT, "drafts");
const APPROVED_DIR = path.join(CONTENT_ASSIST_ROOT, "approved");

export async function listContentAssistWorkspace({
  domain,
}: {
  domain: string;
}): Promise<ContentAssistWorkspaceItem[]> {
  const [knowledgeItems, drafts] = await Promise.all([
    getKnowledgeItemSummaries({
      domain,
    }),
    readAllDrafts(),
  ]);
  const draftsBySlug = new Map(drafts.map((draft) => [draft.knowledgeItemSlug, draft]));

  return knowledgeItems.map((knowledgeItem) => {
    const draft = draftsBySlug.get(knowledgeItem.slug);

    return {
      knowledgeItemId: knowledgeItem.id,
      knowledgeItemSlug: knowledgeItem.slug,
      title: knowledgeItem.title,
      domain: knowledgeItem.domain,
      summary: knowledgeItem.summary,
      difficulty: knowledgeItem.difficulty,
      draftStatus: draft?.status ?? null,
      draftUpdatedAt: draft?.updatedAt ?? null,
      approvedAt: draft?.approvedAt ?? null,
    };
  });
}

export async function getContentAssistDraft({
  knowledgeItemIdOrSlug,
}: {
  knowledgeItemIdOrSlug: string;
}) {
  const knowledgeItem = await getKnowledgeItemDetail(knowledgeItemIdOrSlug);

  if (!knowledgeItem) {
    return null;
  }

  const existingDraft = await readDraft(knowledgeItem.slug);

  if (existingDraft) {
    return {
      knowledgeItem,
      draft: existingDraft,
    };
  }

  const draft = await generateContentAssistDraft({
    knowledgeItem,
  });

  return {
    knowledgeItem,
    draft,
  };
}

export async function regenerateContentAssistDraft({
  knowledgeItemIdOrSlug,
}: {
  knowledgeItemIdOrSlug: string;
}) {
  const knowledgeItem = await getKnowledgeItemDetail(knowledgeItemIdOrSlug);

  if (!knowledgeItem) {
    return null;
  }

  const draft = await generateContentAssistDraft({
    knowledgeItem,
  });

  return {
    knowledgeItem,
    draft,
  };
}

export async function updateContentAssistDraft({
  knowledgeItemSlug,
  input,
}: {
  knowledgeItemSlug: string;
  input: ContentAssistDraft;
}) {
  const knowledgeItem = await getKnowledgeItemDetail(knowledgeItemSlug);

  if (!knowledgeItem) {
    return null;
  }

  const nextDraft: ContentAssistDraft = {
    ...input,
    schemaVersion: 1,
    knowledgeItemId: knowledgeItem.id,
    knowledgeItemSlug: knowledgeItem.slug,
    knowledgeItemTitle: knowledgeItem.title,
    knowledgeItemDomain: knowledgeItem.domain,
    updatedAt: new Date().toISOString(),
  };

  await saveDraft(nextDraft);

  return nextDraft;
}

export async function approveContentAssistDraft(knowledgeItemSlug: string) {
  const existingDraft = await readDraft(knowledgeItemSlug);

  if (!existingDraft) {
    return null;
  }

  const approvedDraft: ContentAssistDraft = {
    ...existingDraft,
    status: "approved",
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    saveDraft(approvedDraft),
    saveApprovedDraft(approvedDraft),
  ]);

  return approvedDraft;
}

export async function readApprovedContentAssistDrafts() {
  await ensureContentAssistDirectories();
  const files = await readdir(APPROVED_DIR, { withFileTypes: true });
  const drafts = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(APPROVED_DIR, entry.name);
        const content = await readFile(filePath, "utf8");
        return JSON.parse(content) as ContentAssistDraft;
      }),
  );

  return drafts.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

async function generateContentAssistDraft({
  knowledgeItem,
}: {
  knowledgeItem: KnowledgeItemDetail;
}) {
  const relations = (await getKnowledgeItemRelationDetails(knowledgeItem.slug)) ?? [];
  const relationCandidates =
    relations.length > 0
      ? relations.map(toRelationCandidate)
      : await buildDerivedRelationCandidates(knowledgeItem);
  const draft: ContentAssistDraft = {
    schemaVersion: 1,
    knowledgeItemId: knowledgeItem.id,
    knowledgeItemSlug: knowledgeItem.slug,
    knowledgeItemTitle: knowledgeItem.title,
    knowledgeItemDomain: knowledgeItem.domain,
    status: "draft",
    generator: {
      id: "heuristic-v1",
      label: "Heuristic Content Assist v1",
    },
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: null,
    reviewerNotes: "",
    explanation: {
      summary: knowledgeItem.summary,
      body: knowledgeItem.body,
      useConditions:
        knowledgeItem.useConditions.length > 0
          ? knowledgeItem.useConditions
          : buildUseConditionFallback(knowledgeItem),
      nonUseConditions:
        knowledgeItem.nonUseConditions.length > 0
          ? knowledgeItem.nonUseConditions
          : buildNonUseConditionFallback(knowledgeItem),
      antiPatterns:
        knowledgeItem.antiPatterns.length > 0
          ? knowledgeItem.antiPatterns
          : buildAntiPatternFallback(knowledgeItem),
      typicalProblems:
        knowledgeItem.typicalProblems.length > 0
          ? knowledgeItem.typicalProblems
          : buildTypicalProblemFallback(knowledgeItem),
      variableExplanations: knowledgeItem.variables.map((variable) => ({
        symbol: variable.symbol,
        name: variable.name,
        description:
          variable.description ||
          `${variable.name} 是 ${knowledgeItem.title} 中需要先确认含义再代入的变量。`,
        unit: variable.unit,
      })),
    },
    reviewItems: buildReviewItemDrafts(knowledgeItem),
    relationCandidates,
  };

  await saveDraft(draft);

  return draft;
}

async function buildDerivedRelationCandidates(knowledgeItem: KnowledgeItemDetail) {
  const peers = await getKnowledgeItemSummaries({
    domain: knowledgeItem.domain,
  });

  return peers
    .filter((candidate) => candidate.slug !== knowledgeItem.slug)
    .map((candidate) => ({
      candidate,
      overlapScore: candidate.tags.filter((tag) => knowledgeItem.tags.includes(tag)).length,
    }))
    .filter((candidate) => candidate.overlapScore > 0)
    .sort((left, right) => {
      if (right.overlapScore !== left.overlapScore) {
        return right.overlapScore - left.overlapScore;
      }

      return left.candidate.difficulty - right.candidate.difficulty;
    })
    .slice(0, 3)
    .map(({ candidate }) => ({
      toSlug: candidate.slug,
      toTitle: candidate.title,
      relationType:
        candidate.subdomain && knowledgeItem.subdomain && candidate.subdomain === knowledgeItem.subdomain
          ? "confusable"
          : "related",
      note:
        candidate.subdomain && knowledgeItem.subdomain && candidate.subdomain === knowledgeItem.subdomain
          ? `两条知识项都在 ${knowledgeItem.subdomain} 下，适合一起审查边界和误用。`
          : `两条知识项都服务于 ${knowledgeItem.domain}，可以一起整理应用链路。`,
    })) satisfies ContentAssistRelationDraft[];
}

function buildReviewItemDrafts(knowledgeItem: KnowledgeItemDetail): ContentAssistReviewItemDraft[] {
  const existingByType = new Map(knowledgeItem.reviewItems.map((item) => [item.type, item]));

  return [
    {
      type: "recall",
      prompt:
        existingByType.get("recall")?.prompt ??
        `写出 ${knowledgeItem.title} 的核心表达式，并说明它什么时候该用。`,
      answer:
        existingByType.get("recall")?.answer ??
        knowledgeItemRenderPayloadToText(
          knowledgeItem.contentType,
          knowledgeItem.renderPayload,
        ),
      explanation:
        existingByType.get("recall")?.explanation ??
        knowledgeItem.summary,
      difficulty: existingByType.get("recall")?.difficulty ?? Math.max(1, knowledgeItem.difficulty - 1),
    },
    {
      type: "recognition",
      prompt:
        existingByType.get("recognition")?.prompt ??
        `题目出现“${knowledgeItem.typicalProblems[0] ?? knowledgeItem.useConditions[0] ?? knowledgeItem.domain}”时，应优先想到哪条知识项？`,
      answer:
        existingByType.get("recognition")?.answer ?? knowledgeItem.title,
      explanation:
        existingByType.get("recognition")?.explanation ??
        `这是 ${knowledgeItem.title} 的典型触发信号，先确认 ${knowledgeItem.useConditions[0] ?? "条件方向"}。`,
      difficulty: existingByType.get("recognition")?.difficulty ?? knowledgeItem.difficulty,
    },
    {
      type: "application",
      prompt:
        existingByType.get("application")?.prompt ??
        knowledgeItem.examples[0] ??
        `请根据 ${knowledgeItem.title} 设计一个小题，并演示如何代入求解。`,
      answer:
        existingByType.get("application")?.answer ??
        `${knowledgeItem.summary}。先确认 ${knowledgeItem.useConditions[0] ?? "使用条件"}，再按知识项结构代入。`,
      explanation:
        existingByType.get("application")?.explanation ??
        `${knowledgeItem.antiPatterns[0] ?? "先确认边界，再代入计算。"}。`,
      difficulty: existingByType.get("application")?.difficulty ?? Math.max(knowledgeItem.difficulty, 2),
    },
  ];
}

function buildUseConditionFallback(knowledgeItem: KnowledgeItemDetail) {
  return [
    `题目目标与“${knowledgeItem.summary}”一致时优先考虑 ${knowledgeItem.title}。`,
    knowledgeItem.typicalProblems[0]
      ? `看到“${knowledgeItem.typicalProblems[0]}”这类题型时，可以先检查 ${knowledgeItem.title} 是否适用。`
      : `先确认题目是不是在求 ${knowledgeItem.title} 处理的那类关系。`,
  ];
}

function buildNonUseConditionFallback(knowledgeItem: KnowledgeItemDetail) {
  return [
    knowledgeItem.antiPatterns[0]
      ? `如果你准备直接这样做：“${knowledgeItem.antiPatterns[0]}”，通常说明现在不该直接套 ${knowledgeItem.title}。`
      : `如果题目目标不是“${knowledgeItem.summary}”，先不要直接套 ${knowledgeItem.title}。`,
  ];
}

function buildAntiPatternFallback(knowledgeItem: KnowledgeItemDetail) {
  return [
    `不要在没确认条件方向前就直接套 ${knowledgeItem.title}。`,
    `代入前先检查变量含义是否和 ${knowledgeItem.title} 中的定义一致。`,
    `如果题型更接近“${knowledgeItem.typicalProblems[0] ?? knowledgeItem.domain}”之外的场景，先确认是否换知识项。`,
  ];
}

function buildTypicalProblemFallback(knowledgeItem: KnowledgeItemDetail) {
  return [
    `${knowledgeItem.domain} 中需要判断 ${knowledgeItem.title} 适用边界的题。`,
  ];
}

function toRelationCandidate(relation: KnowledgeItemRelationDetail): ContentAssistRelationDraft {
  return {
    toSlug: relation.knowledgeItem.slug,
    toTitle: relation.knowledgeItem.title,
    relationType: relation.relationType,
    note: relation.note ?? "",
  };
}

async function readAllDrafts() {
  await ensureContentAssistDirectories();
  const files = await readdir(DRAFTS_DIR, { withFileTypes: true });
  const drafts = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(DRAFTS_DIR, entry.name);
        const content = await readFile(filePath, "utf8");
        return JSON.parse(content) as ContentAssistDraft;
      }),
  );

  return drafts.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

async function readDraft(knowledgeItemSlug: string) {
  await ensureContentAssistDirectories();
  const filePath = path.join(DRAFTS_DIR, `${knowledgeItemSlug}.json`);

  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as ContentAssistDraft;
  } catch {
    return null;
  }
}

async function saveDraft(draft: ContentAssistDraft) {
  await ensureContentAssistDirectories();
  const filePath = path.join(DRAFTS_DIR, `${draft.knowledgeItemSlug}.json`);
  await writeFile(filePath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}

async function saveApprovedDraft(draft: ContentAssistDraft) {
  await ensureContentAssistDirectories();
  const filePath = path.join(APPROVED_DIR, `${draft.knowledgeItemSlug}.json`);
  await writeFile(filePath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}

async function ensureContentAssistDirectories() {
  await Promise.all([
    mkdir(DRAFTS_DIR, { recursive: true }),
    mkdir(APPROVED_DIR, { recursive: true }),
  ]);
}

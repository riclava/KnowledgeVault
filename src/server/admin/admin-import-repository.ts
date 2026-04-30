import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import type {
  AdminImportBatch,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";
import { buildOwnedKnowledgeItemData } from "@/server/repositories/knowledge-item-visibility";

type ExistingSlugToId = Map<string, string>;
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type ImportSaveScope =
  | { scope: "admin" }
  | { scope: "learner"; userId: string };

export type AdminImportWritePlan = {
  createSlugs: string[];
  updateSlugs: string[];
  relationSourceSlugs: string[];
};

export type ReviewItemReplacementPlan = {
  deleteIds: string[];
  archiveIds: string[];
};

export type AdminImportDedupeExistingItem = {
  id: string;
  slug: string;
  title: string;
  contentType: string;
  domain: string;
  subdomain: string | null;
  summary: string;
  body: string;
  tags: string[];
};

export function buildAdminImportWritePlan(
  batch: AdminImportBatch,
  existingSlugToId: ExistingSlugToId,
): AdminImportWritePlan {
  return {
    createSlugs: batch.items
      .filter((item) => !existingSlugToId.has(item.slug))
      .map((item) => item.slug),
    updateSlugs: batch.items
      .filter((item) => existingSlugToId.has(item.slug))
      .map((item) => item.slug),
    relationSourceSlugs: unique(batch.relations.map((relation) => relation.fromSlug)),
  };
}

export function partitionReviewItemIdsForReplacement(
  reviewItems: Array<{
    id: string;
    _count: {
      reviewLogs: number;
    };
  }>,
): ReviewItemReplacementPlan {
  return reviewItems.reduce<ReviewItemReplacementPlan>(
    (plan, reviewItem) => {
      if (reviewItem._count.reviewLogs > 0) {
        plan.archiveIds.push(reviewItem.id);
      } else {
        plan.deleteIds.push(reviewItem.id);
      }

      return plan;
    },
    { deleteIds: [], archiveIds: [] },
  );
}

export function buildPrivateImportSlugMap({
  requestedSlugs,
  occupiedSlugs,
  namespace,
}: {
  requestedSlugs: string[];
  occupiedSlugs: Set<string>;
  namespace: string;
}) {
  const suffix = namespace.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "private";

  return new Map(
    requestedSlugs.map((slug) => [
      slug,
      occupiedSlugs.has(slug) ? `${slug}-${suffix}` : slug,
    ]),
  );
}

export function buildInitialImportedKnowledgeItemState({
  userId,
  knowledgeItemId,
  difficulty,
  now,
}: {
  userId: string;
  knowledgeItemId: string;
  difficulty: number;
  now: Date;
}) {
  return {
    userId,
    knowledgeItemId,
    memoryStrength: 0.05,
    stability: 0,
    difficultyEstimate: difficulty,
    nextReviewAt: now,
  };
}

export async function listExistingKnowledgeItemIdsBySlug(slugs: string[]) {
  return listExistingKnowledgeItemIdsBySlugWithClient(prisma, slugs);
}

export async function listPublicKnowledgeItemsForImportDedupe(domains: string[]) {
  const uniqueDomains = unique(domains).filter(Boolean);

  if (uniqueDomains.length === 0) {
    return [];
  }

  return prisma.knowledgeItem.findMany({
    where: {
      visibility: "public",
      domain: { in: uniqueDomains },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      contentType: true,
      domain: true,
      subdomain: true,
      summary: true,
      body: true,
      tags: true,
    },
  });
}

export async function createAdminImportRun({
  adminUserId,
  sourceTitle,
  sourceExcerpt,
  defaultDomain,
  status,
  generatedCount = 0,
  savedCount = 0,
  validationErrors,
  aiOutput,
}: {
  adminUserId: string;
  sourceTitle?: string;
  sourceExcerpt: string;
  defaultDomain: string;
  status: "validation_failed" | "saved" | "ai_failed";
  generatedCount?: number;
  savedCount?: number;
  validationErrors?: AdminImportValidationError[];
  aiOutput?: unknown;
}) {
  return prisma.adminImportRun.create({
    data: {
      adminUserId,
      sourceTitle: sourceTitle ?? null,
      sourceExcerpt,
      defaultDomain,
      status,
      generatedCount,
      savedCount,
      validationErrors: toNullableJsonInput(validationErrors),
      aiOutput: toNullableJsonInput(aiOutput),
    },
  });
}

export async function getAdminImportRunForAdmin({
  id,
  adminUserId,
}: {
  id: string;
  adminUserId: string;
}) {
  return prisma.adminImportRun.findFirst({
    where: {
      id,
      adminUserId,
    },
  });
}

export async function markAdminImportRunValidationFailed({
  id,
  validationErrors,
  aiOutput,
}: {
  id: string;
  validationErrors: AdminImportValidationError[];
  aiOutput?: unknown;
}) {
  return prisma.adminImportRun.update({
    where: { id },
    data: {
      status: "validation_failed",
      savedCount: 0,
      validationErrors: toNullableJsonInput(validationErrors),
      ...(aiOutput === undefined ? {} : { aiOutput: toNullableJsonInput(aiOutput) }),
    },
  });
}

export async function saveAdminImportBatch({
  adminUserId,
  sourceTitle,
  sourceExcerpt,
  batch,
  aiOutput,
  importRunId,
  saveScope = { scope: "admin" },
}: {
  adminUserId: string;
  sourceTitle?: string;
  sourceExcerpt: string;
  batch: AdminImportBatch;
  aiOutput?: unknown;
  importRunId?: string;
  saveScope?: ImportSaveScope;
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const referencedSlugs = unique([
      ...batch.items.map((item) => item.slug),
      ...batch.relations.map((relation) => relation.fromSlug),
      ...batch.relations.map((relation) => relation.toSlug),
    ]);
    const slugToId = await listExistingKnowledgeItemIdsBySlugWithClient(
      tx,
      referencedSlugs,
    );
    const generatedSlugToSavedSlug =
      saveScope.scope === "learner"
        ? buildPrivateImportSlugMap({
            requestedSlugs: batch.items.map((item) => item.slug),
            occupiedSlugs: new Set(slugToId.keys()),
            namespace: importRunId ?? saveScope.userId,
          })
        : new Map(batch.items.map((item) => [item.slug, item.slug]));

    for (const item of batch.items) {
      const savedSlug = generatedSlugToSavedSlug.get(item.slug) ?? item.slug;
      const savedItem = saveScope.scope === "admin" && slugToId.has(savedSlug)
        ? await tx.knowledgeItem.update({
            where: { slug: savedSlug },
            data: {
              ...toKnowledgeItemData(item),
              ...buildOwnedKnowledgeItemData({ scope: "admin" }),
            },
            select: { id: true, slug: true },
          })
        : await tx.knowledgeItem.create({
            data: {
              ...toKnowledgeItemData(item),
              ...buildOwnedKnowledgeItemData(saveScope),
              slug: savedSlug,
            },
            select: { id: true, slug: true },
          });

      slugToId.set(savedItem.slug, savedItem.id);
      slugToId.set(item.slug, savedItem.id);

      const existingQuestionBindings = await tx.questionKnowledgeItem.findMany({
        where: { knowledgeItemId: savedItem.id },
        select: { questionId: true },
      });
      const existingQuestionIds = existingQuestionBindings.map(
        (binding) => binding.questionId,
      );

      await tx.questionKnowledgeItem.deleteMany({
        where: { knowledgeItemId: savedItem.id },
      });

      if (existingQuestionIds.length > 0) {
        await tx.question.deleteMany({
          where: { id: { in: existingQuestionIds } },
        });
      }

      if (item.reviewItems.length > 0) {
        for (const reviewItem of item.reviewItems) {
          await tx.question.create({
            data: {
            type: reviewItem.type,
            prompt: reviewItem.prompt,
              options:
                reviewItem.type === "single_choice"
                  ? [
                      { id: "a", text: reviewItem.answer },
                      { id: "b", text: "以上都不适合" },
                    ]
                  : undefined,
              answer:
                reviewItem.type === "single_choice"
                  ? { optionId: "a" }
                  : { text: reviewItem.answer },
              answerAliases: [reviewItem.answer],
            explanation: reviewItem.explanation ?? null,
            difficulty: reviewItem.difficulty,
              tags: item.tags,
              gradingMode:
                reviewItem.type === "short_answer" ? "ai" : "rule",
              knowledgeItems: {
                create: {
                  knowledgeItemId: savedItem.id,
                },
              },
            },
          });
        }
      }

      if (saveScope.scope === "learner") {
        await tx.userKnowledgeItemState.upsert({
          where: {
            userId_knowledgeItemId: {
              userId: saveScope.userId,
              knowledgeItemId: savedItem.id,
            },
          },
          create: buildInitialImportedKnowledgeItemState({
            userId: saveScope.userId,
            knowledgeItemId: savedItem.id,
            difficulty: item.difficulty,
            now,
          }),
          update: buildInitialImportedKnowledgeItemState({
            userId: saveScope.userId,
            knowledgeItemId: savedItem.id,
            difficulty: item.difficulty,
            now,
          }),
        });
      }
    }

    const relationSourceIds = unique(
      batch.relations.map((relation) =>
        requireKnownKnowledgeItemId(slugToId, relation.fromSlug),
      ),
    );

    if (relationSourceIds.length > 0) {
      await tx.knowledgeItemRelation.deleteMany({
        where: { fromKnowledgeItemId: { in: relationSourceIds } },
      });
    }

    if (batch.relations.length > 0) {
      await tx.knowledgeItemRelation.createMany({
        data: batch.relations.map((relation) => ({
          fromKnowledgeItemId: requireKnownKnowledgeItemId(slugToId, relation.fromSlug),
          toKnowledgeItemId: requireKnownKnowledgeItemId(slugToId, relation.toSlug),
          relationType: relation.relationType,
          note: relation.note ?? null,
        })),
      });
    }

    const importRunData = {
      adminUserId,
      sourceTitle: sourceTitle ?? batch.sourceTitle ?? null,
      sourceExcerpt,
      defaultDomain: batch.defaultDomain ?? "",
      status: "saved" as const,
      generatedCount: batch.items.length,
      savedCount: batch.items.length,
      validationErrors: Prisma.JsonNull,
      aiOutput: toNullableJsonInput(aiOutput),
    };

    if (importRunId) {
      return tx.adminImportRun.update({
        where: { id: importRunId },
        data: importRunData,
      });
    }

    return tx.adminImportRun.create({
      data: importRunData,
    });
  });
}

export async function listRecentAdminImportRuns(take = 10) {
  return prisma.adminImportRun.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}

function toKnowledgeItemData(
  item: AdminImportBatch["items"][number],
): Omit<Prisma.KnowledgeItemUncheckedCreateInput, "slug"> {
  return {
    title: item.title,
    contentType: item.contentType,
    renderPayload: toJsonInput(
      normalizeKnowledgeItemRenderPayload(item.contentType, item.renderPayload),
    ),
    domain: item.domain,
    subdomain: item.subdomain ?? null,
    summary: item.summary,
    body: item.body,
    difficulty: item.difficulty,
    tags: item.tags,
    extension: Prisma.JsonNull,
  };
}

async function listExistingKnowledgeItemIdsBySlugWithClient(
  client: Pick<TransactionClient, "knowledgeItem">,
  slugs: string[],
) {
  const uniqueSlugs = unique(slugs);

  if (uniqueSlugs.length === 0) {
    return new Map<string, string>();
  }

  const rows = await client.knowledgeItem.findMany({
    where: { slug: { in: uniqueSlugs } },
    select: { id: true, slug: true },
  });

  return new Map(rows.map((row) => [row.slug, row.id]));
}

function requireKnownKnowledgeItemId(slugToId: ExistingSlugToId, slug: string) {
  const id = slugToId.get(slug);

  if (!id) {
    throw new Error(`Knowledge item slug not found for admin import relation: ${slug}`);
  }

  return id;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJsonInput(
  value: unknown,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return toJsonInput(value);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

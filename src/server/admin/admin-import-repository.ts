import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import type {
  AdminImportBatch,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";

type ExistingSlugToId = Map<string, string>;
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type AdminImportWritePlan = {
  createSlugs: string[];
  updateSlugs: string[];
  relationSourceSlugs: string[];
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

export async function listExistingKnowledgeItemIdsBySlug(slugs: string[]) {
  return listExistingKnowledgeItemIdsBySlugWithClient(prisma, slugs);
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

export async function saveAdminImportBatch({
  adminUserId,
  sourceTitle,
  sourceExcerpt,
  batch,
  aiOutput,
}: {
  adminUserId: string;
  sourceTitle?: string;
  sourceExcerpt: string;
  batch: AdminImportBatch;
  aiOutput?: unknown;
}) {
  return prisma.$transaction(async (tx) => {
    const referencedSlugs = unique([
      ...batch.items.map((item) => item.slug),
      ...batch.relations.map((relation) => relation.fromSlug),
      ...batch.relations.map((relation) => relation.toSlug),
    ]);
    const slugToId = await listExistingKnowledgeItemIdsBySlugWithClient(
      tx,
      referencedSlugs,
    );

    for (const item of batch.items) {
      const savedItem = slugToId.has(item.slug)
        ? await tx.knowledgeItem.update({
            where: { slug: item.slug },
            data: toKnowledgeItemData(item),
            select: { id: true, slug: true },
          })
        : await tx.knowledgeItem.create({
            data: {
              ...toKnowledgeItemData(item),
              slug: item.slug,
            },
            select: { id: true, slug: true },
          });

      slugToId.set(savedItem.slug, savedItem.id);

      await tx.knowledgeItemVariable.deleteMany({
        where: { knowledgeItemId: savedItem.id },
      });

      if (item.variables.length > 0) {
        await tx.knowledgeItemVariable.createMany({
          data: item.variables.map((variable, index) => ({
            knowledgeItemId: savedItem.id,
            symbol: variable.symbol,
            name: variable.name,
            description: variable.description,
            unit: variable.unit ?? null,
            sortOrder: variable.sortOrder ?? index,
          })),
        });
      }

      await tx.reviewItem.deleteMany({
        where: { knowledgeItemId: savedItem.id },
      });

      if (item.reviewItems.length > 0) {
        await tx.reviewItem.createMany({
          data: item.reviewItems.map((reviewItem) => ({
            knowledgeItemId: savedItem.id,
            type: reviewItem.type,
            prompt: reviewItem.prompt,
            answer: reviewItem.answer,
            explanation: reviewItem.explanation ?? null,
            difficulty: reviewItem.difficulty,
          })),
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

    return tx.adminImportRun.create({
      data: {
        adminUserId,
        sourceTitle: sourceTitle ?? batch.sourceTitle ?? null,
        sourceExcerpt,
        defaultDomain: batch.defaultDomain ?? "",
        status: "saved",
        generatedCount: batch.items.length,
        savedCount: batch.items.length,
        validationErrors: Prisma.JsonNull,
        aiOutput: toNullableJsonInput(aiOutput),
      },
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
    intuition: item.intuition ?? null,
    deepDive: item.deepDive ?? null,
    useConditions: item.useConditions,
    nonUseConditions: item.nonUseConditions,
    antiPatterns: item.antiPatterns,
    typicalProblems: item.typicalProblems,
    examples: item.examples,
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

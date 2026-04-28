import type { KnowledgeItemType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  listExistingKnowledgeItemIdsBySlug,
  saveAdminImportBatch,
} from "@/server/admin/admin-import-repository";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";
import {
  normalizeAdminImportBatch,
  validateAdminImportBatch,
} from "@/server/admin/admin-import-validation";

const SUPPORTED_CONTENT_TYPES = new Set<string>([
  "math_formula",
  "vocabulary",
  "plain_text",
  "concept_card",
  "comparison_table",
  "procedure",
]);

export type AdminKnowledgeItemListParams = {
  query?: string;
  domain?: string;
  contentType?: KnowledgeItemType;
  difficulties?: number[];
  tag?: string;
};

export function normalizeAdminKnowledgeItemSearchParams(
  searchParams: URLSearchParams,
): AdminKnowledgeItemListParams {
  const query = trimmedParam(searchParams, "query");
  const domain = trimmedParam(searchParams, "domain");
  const contentType = normalizeContentType(searchParams.get("contentType"));
  const difficulties = normalizeDifficulties(searchParams.getAll("difficulty"));
  const tag = trimmedParam(searchParams, "tag");

  return {
    ...(query ? { query } : {}),
    ...(domain ? { domain } : {}),
    ...(contentType ? { contentType } : {}),
    ...(difficulties.length > 0 ? { difficulties } : {}),
    ...(tag ? { tag } : {}),
  };
}

export async function listAdminKnowledgeItems(
  params: AdminKnowledgeItemListParams,
) {
  return prisma.knowledgeItem.findMany({
    where: buildKnowledgeItemWhere(params),
    include: {
      _count: {
        select: {
          variables: true,
          reviewItems: {
            where: {
              isActive: true,
            },
          },
          outgoingRelations: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listAdminKnowledgeItemDomains() {
  const rows = await prisma.knowledgeItem.findMany({
    distinct: ["domain"],
    select: {
      domain: true,
    },
    orderBy: {
      domain: "asc",
    },
  });

  return rows.map((row) => row.domain);
}

export async function getAdminKnowledgeItem(idOrSlug: string) {
  return prisma.knowledgeItem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      variables: {
        orderBy: { sortOrder: "asc" },
      },
      reviewItems: {
        where: {
          isActive: true,
        },
        orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
      },
      outgoingRelations: {
        include: {
          toKnowledgeItem: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
        orderBy: [{ relationType: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function deleteAdminKnowledgeItem(id: string) {
  return prisma.knowledgeItem.delete({
    where: { id },
  });
}

export function normalizeAdminKnowledgeItemFormInput(
  input: unknown,
): AdminImportBatch {
  const record = isRecord(input) ? input : {};
  const relations = Array.isArray(record.relations) ? record.relations : [];

  return normalizeAdminImportBatch({
    defaultDomain: text(record.domain),
    items: [record as AdminImportBatch["items"][number]],
    relations: relations as AdminImportBatch["relations"],
  });
}

export async function saveAdminKnowledgeItemAggregate({
  adminUserId,
  input,
}: {
  adminUserId: string;
  input: unknown;
}) {
  const batch = normalizeAdminKnowledgeItemFormInput(input);
  const referencedSlugs = unique([
    ...batch.items.map((item) => item.slug),
    ...batch.relations.map((relation) => relation.fromSlug),
    ...batch.relations.map((relation) => relation.toSlug),
  ]);
  const existingSlugs = await listExistingKnowledgeItemIdsBySlug(referencedSlugs);
  const validation = validateAdminImportBatch(
    batch,
    new Set(existingSlugs.keys()),
  );

  if (!validation.ok) {
    return { ok: false as const, errors: validation.errors };
  }

  const importRun = await saveAdminImportBatch({
    adminUserId,
    sourceExcerpt: "Manual admin form save",
    batch: validation.batch,
    aiOutput: validation.batch,
  });
  const relationSourceSlugs = new Set(
    validation.batch.relations.map((relation) => relation.fromSlug),
  );
  const slugsWithoutRelations = validation.batch.items
    .map((item) => item.slug)
    .filter((slug) => !relationSourceSlugs.has(slug));

  if (slugsWithoutRelations.length > 0) {
    await prisma.knowledgeItemRelation.deleteMany({
      where: {
        fromKnowledgeItem: {
          slug: { in: slugsWithoutRelations },
        },
      },
    });
  }

  return { ok: true as const, importRun };
}

function buildKnowledgeItemWhere(
  params: AdminKnowledgeItemListParams,
): Prisma.KnowledgeItemWhereInput {
  const where: Prisma.KnowledgeItemWhereInput = {
    ...(params.domain ? { domain: params.domain } : {}),
    ...(params.contentType ? { contentType: params.contentType } : {}),
    ...(params.difficulties && params.difficulties.length > 0
      ? { difficulty: { in: params.difficulties } }
      : {}),
    ...(params.tag ? { tags: { has: params.tag } } : {}),
  };

  if (params.query) {
    where.OR = [
      { title: { contains: params.query, mode: "insensitive" } },
      { slug: { contains: params.query, mode: "insensitive" } },
      { summary: { contains: params.query, mode: "insensitive" } },
      { body: { contains: params.query, mode: "insensitive" } },
      { tags: { has: params.query } },
    ];
  }

  return where;
}

function normalizeContentType(value: string | null) {
  const normalized = value?.trim();

  if (!normalized || !SUPPORTED_CONTENT_TYPES.has(normalized)) {
    return undefined;
  }

  return normalized as KnowledgeItemType;
}

function normalizeDifficulties(values: string[]) {
  const difficulties = values.flatMap((value) => {
    const normalized = value.trim();

    if (!normalized) {
      return [];
    }

    const difficulty = Number(normalized);

    return Number.isInteger(difficulty) ? [difficulty] : [];
  });

  return unique(difficulties);
}

function trimmedParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
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

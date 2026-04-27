import type { KnowledgeItemType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const SUPPORTED_CONTENT_TYPES = new Set<string>([
  "math_formula",
  "vocabulary",
  "plain_text",
]);

export type AdminKnowledgeItemListParams = {
  query?: string;
  domain?: string;
  contentType?: KnowledgeItemType;
  difficulty?: number;
  tag?: string;
};

export function normalizeAdminKnowledgeItemSearchParams(
  searchParams: URLSearchParams,
): AdminKnowledgeItemListParams {
  const query = trimmedParam(searchParams, "query");
  const domain = trimmedParam(searchParams, "domain");
  const contentType = normalizeContentType(searchParams.get("contentType"));
  const difficulty = normalizeDifficulty(searchParams.get("difficulty"));
  const tag = trimmedParam(searchParams, "tag");

  return {
    ...(query ? { query } : {}),
    ...(domain ? { domain } : {}),
    ...(contentType ? { contentType } : {}),
    ...(difficulty !== undefined ? { difficulty } : {}),
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
          reviewItems: true,
          outgoingRelations: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
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

function buildKnowledgeItemWhere(
  params: AdminKnowledgeItemListParams,
): Prisma.KnowledgeItemWhereInput {
  const where: Prisma.KnowledgeItemWhereInput = {
    ...(params.domain ? { domain: params.domain } : {}),
    ...(params.contentType ? { contentType: params.contentType } : {}),
    ...(typeof params.difficulty === "number"
      ? { difficulty: params.difficulty }
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

function normalizeDifficulty(value: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  const difficulty = Number(normalized);

  return Number.isInteger(difficulty) ? difficulty : undefined;
}

function trimmedParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

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
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function normalizeAdminKnowledgeItemSearchParams(
  searchParams: URLSearchParams,
): AdminKnowledgeItemListParams {
  const query = trimmedParam(searchParams, "query");
  const domain = trimmedParam(searchParams, "domain");
  const contentType = normalizeContentType(searchParams.get("contentType"));
  const difficulties = normalizeDifficulties(searchParams.getAll("difficulty"));
  const tag = trimmedParam(searchParams, "tag");
  const page = normalizePositiveInteger(
    searchParams.get("page"),
    DEFAULT_PAGE,
  );
  const pageSize = normalizePageSize(searchParams.get("pageSize"));

  return {
    ...(query ? { query } : {}),
    ...(domain ? { domain } : {}),
    ...(contentType ? { contentType } : {}),
    ...(difficulties.length > 0 ? { difficulties } : {}),
    ...(tag ? { tag } : {}),
    page,
    pageSize,
  };
}

export async function listAdminKnowledgeItems(
  params: AdminKnowledgeItemListParams,
) {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildKnowledgeItemWhere(params);
  const total = await prisma.knowledgeItem.count({ where });
  const items = await prisma.knowledgeItem.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { updatedAt: "desc" },
    include: {
      createdByUser: {
        select: {
          displayName: true,
          email: true,
        },
      },
      _count: {
        select: {
          questionBindings: {
            where: {
              question: {
                isActive: true,
              },
            },
          },
          outgoingRelations: true,
        },
      },
    },
  });

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
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

export async function listAdminKnowledgeItemDomainOptions() {
  const rows = await prisma.knowledgeItem.findMany({
    select: {
      domain: true,
      subdomain: true,
    },
    orderBy: [{ domain: "asc" }, { subdomain: "asc" }],
  });
  const domains: string[] = [];
  const seenDomains = new Set<string>();
  const subdomainsByDomain: Record<string, string[]> = {};
  const seenSubdomainsByDomain = new Map<string, Set<string>>();

  for (const row of rows) {
    const domain = text(row.domain);
    const subdomain = text(row.subdomain);

    if (!domain) {
      continue;
    }

    if (!seenDomains.has(domain)) {
      seenDomains.add(domain);
      domains.push(domain);
      subdomainsByDomain[domain] = [];
      seenSubdomainsByDomain.set(domain, new Set());
    }

    if (!subdomain) {
      continue;
    }

    const seenSubdomains = seenSubdomainsByDomain.get(domain);

    if (seenSubdomains && !seenSubdomains.has(subdomain)) {
      seenSubdomains.add(subdomain);
      subdomainsByDomain[domain]?.push(subdomain);
    }
  }

  return {
    domains,
    subdomainsByDomain,
  };
}

export async function getAdminKnowledgeItem(idOrSlug: string) {
  return prisma.knowledgeItem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      createdByUser: {
        select: {
          displayName: true,
          email: true,
        },
      },
      questionBindings: {
        where: {
          question: {
            isActive: true,
          },
        },
        include: {
          question: true,
        },
        orderBy: { createdAt: "asc" },
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

export function normalizeAdminKnowledgeItemBulkDeleteInput(input: unknown) {
  const record = isRecord(input) ? input : {};
  const ids = Array.isArray(record.ids)
    ? unique(record.ids.filter(isString).map(text).filter(Boolean))
    : [];

  if (ids.length === 0) {
    return { ok: false as const, error: "请选择要删除的知识项。" };
  }

  return { ok: true as const, ids };
}

export async function bulkDeleteAdminKnowledgeItems(input: unknown) {
  const normalized = normalizeAdminKnowledgeItemBulkDeleteInput(input);

  if (!normalized.ok) {
    return normalized;
  }

  const result = await prisma.knowledgeItem.deleteMany({
    where: { id: { in: normalized.ids } },
  });

  return { ok: true as const, count: result.count };
}

export async function bulkUpdateAdminKnowledgeItemDomain(input: unknown) {
  const record = isRecord(input) ? input : {};
  const ids = Array.isArray(record.ids)
    ? unique(record.ids.map(text).filter(Boolean))
    : [];
  const domain = text(record.domain);
  const subdomain = text(record.subdomain);
  const clearSubdomain = record.clearSubdomain === true;

  if (ids.length === 0) {
    return { ok: false as const, error: "请选择要修改的知识项。" };
  }

  if (!domain) {
    return { ok: false as const, error: "领域不能为空。" };
  }

  const data: Prisma.KnowledgeItemUpdateManyMutationInput = {
    domain,
    ...(clearSubdomain
      ? { subdomain: null }
      : subdomain
        ? { subdomain }
        : {}),
  };

  const result = await prisma.knowledgeItem.updateMany({
    where: { id: { in: ids } },
    data,
  });

  return { ok: true as const, count: result.count };
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

function normalizePositiveInteger(value: string | null, fallback: number) {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized < 1) {
    return fallback;
  }

  return normalized;
}

function normalizePageSize(value: string | null) {
  const normalized = normalizePositiveInteger(value, DEFAULT_PAGE_SIZE);

  if (normalized > MAX_PAGE_SIZE) {
    return DEFAULT_PAGE_SIZE;
  }

  return normalized;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

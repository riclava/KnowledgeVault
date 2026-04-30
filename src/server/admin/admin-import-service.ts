import { generateAdminImportBatch } from "@/server/admin/admin-import-ai";
import {
  createAdminImportRun,
  getAdminImportRunForAdmin,
  listExistingKnowledgeItemIdsBySlug,
  listPublicKnowledgeItemsForImportDedupe,
  listRecentAdminImportRuns,
  markAdminImportRunValidationFailed,
  saveAdminImportBatch,
  type AdminImportDedupeExistingItem,
} from "@/server/admin/admin-import-repository";
import type {
  AdminImportBatch,
  AdminImportDedupeWarning,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";
import {
  normalizeAdminImportBatch,
  validateAdminImportBatch,
} from "@/server/admin/admin-import-validation";
import {
  scoreKnowledgeDedupePair,
  type KnowledgeDedupeScoredItem,
} from "@/server/admin/knowledge-dedupe-similarity";

export type AdminImportRequest = {
  sourceMaterial: string;
  sourceTitle?: string;
  defaultDomain?: string;
  defaultSubdomain?: string;
  preferredContentTypes?: string[];
};

export type AdminImportActionRequest =
  | {
      mode: "preview";
      input: AdminImportRequest;
    }
  | {
      mode: "save";
      importRunId: string;
      batch?: AdminImportBatch;
      allowDedupeOverride?: boolean;
    };

type GeneratedAdminImportBatch = Awaited<ReturnType<typeof generateAdminImportBatch>>;

const IMPORT_DEDUPE_THRESHOLD = 0.55;

export function normalizeAdminImportActionRequest(
  input: unknown,
): AdminImportActionRequest {
  const record = isRecord(input) ? input : {};
  const mode = text(record.mode);

  if (mode === "save") {
    const importRunId = text(record.importRunId);

    if (!importRunId) {
      throw new Error("预览批次不能为空。");
    }

    return {
      mode: "save",
      importRunId,
      ...(record.allowDedupeOverride === true
        ? { allowDedupeOverride: true }
        : {}),
      ...(isRecord(record.batch)
        ? {
            batch: normalizeAdminImportBatch(
              record.batch as unknown as AdminImportBatch,
            ),
          }
        : {}),
    };
  }

  return {
    mode: "preview",
    input: normalizeAdminImportRequest(record),
  };
}

export function normalizeAdminImportRequest(input: unknown): AdminImportRequest {
  const record = isRecord(input) ? input : {};
  const sourceMaterial = text(record.sourceMaterial);
  const defaultDomain = text(record.defaultDomain);

  if (!sourceMaterial) {
    throw new Error("素材不能为空。");
  }

  const sourceTitle = optionalText(record.sourceTitle);
  const defaultSubdomain = optionalText(record.defaultSubdomain);
  const preferredContentTypes = Array.isArray(record.preferredContentTypes)
    ? record.preferredContentTypes.flatMap((value) => {
        const normalized = text(value);

        return normalized ? [normalized] : [];
      })
    : undefined;

  return {
    sourceMaterial,
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(defaultDomain ? { defaultDomain } : {}),
    ...(defaultSubdomain ? { defaultSubdomain } : {}),
    ...(preferredContentTypes ? { preferredContentTypes } : {}),
  };
}

export async function runAdminImport({
  adminUserId,
  input,
}: {
  adminUserId: string;
  input: AdminImportRequest;
}) {
  const preview = await previewAdminImport({ adminUserId, input });

  if (preview.status !== "previewed") {
    return preview;
  }

  return savePreviewedAdminImport({
    adminUserId,
    importRunId: preview.importRun.id,
  });
}

export async function previewAdminImport({
  adminUserId,
  input,
  checkDedupe = true,
}: {
  adminUserId: string;
  input: AdminImportRequest;
  checkDedupe?: boolean;
}) {
  const sourceExcerpt = input.sourceMaterial.slice(0, 1000);
  let generated: GeneratedAdminImportBatch;

  try {
    generated = await generateAdminImportBatch(input);
  } catch (error) {
    const importRun = await createAdminImportRun({
      adminUserId,
      sourceTitle: input.sourceTitle,
      sourceExcerpt,
      defaultDomain: input.defaultDomain ?? "",
      status: "ai_failed",
      generatedCount: 0,
      savedCount: 0,
      validationErrors: [toPipelineError(error, "AI 生成失败，请稍后重试。")],
    });

    return { status: "ai_failed" as const, importRun };
  }

  const validation = await validateGeneratedAdminImport(
    generated as unknown as AdminImportBatch,
  );
  const generatedItems = Array.isArray(generated.items) ? generated.items : [];

  if (!validation.ok) {
    const importRun = await createAdminImportRun({
      adminUserId,
      sourceTitle: input.sourceTitle,
      sourceExcerpt,
      defaultDomain: input.defaultDomain ?? generated.defaultDomain ?? "",
      status: "validation_failed",
      generatedCount: generatedItems.length,
      savedCount: 0,
      validationErrors: validation.errors,
      aiOutput: generated,
    });

    return {
      status: "validation_failed" as const,
      importRun,
      errors: validation.errors,
    };
  }

  const dedupeWarnings = checkDedupe
    ? await findAdminImportDedupeWarnings(validation.batch)
    : [];
  const importRun = await createAdminImportRun({
    adminUserId,
    sourceTitle: input.sourceTitle,
    sourceExcerpt,
    defaultDomain: input.defaultDomain ?? generated.defaultDomain ?? "",
    status: "validation_failed",
    generatedCount: validation.batch.items.length,
    savedCount: 0,
    validationErrors: [],
    aiOutput: validation.batch,
  });

  return {
    status: "previewed" as const,
    importRun,
    generatedCount: validation.batch.items.length,
    dedupeWarnings,
  };
}

export async function previewLearnerImport({
  userId,
  input,
}: {
  userId: string;
  input: AdminImportRequest;
}) {
  const preview = await previewAdminImport({
    adminUserId: userId,
    input,
    checkDedupe: false,
  });

  return preview;
}

export async function savePreviewedAdminImport({
  adminUserId,
  importRunId,
  batch,
  allowDedupeOverride = false,
}: {
  adminUserId: string;
  importRunId: string;
  batch?: AdminImportBatch;
  allowDedupeOverride?: boolean;
}) {
  const previewRun = await getAdminImportRunForAdmin({
    id: importRunId,
    adminUserId,
  });

  if (!previewRun) {
    throw new Error("预览批次不存在。");
  }

  if (
    previewRun.status !== "validation_failed" ||
    previewRun.savedCount !== 0 ||
    !isEmptyJsonArray(previewRun.validationErrors)
  ) {
    throw new Error("只有已生成预览的批次可以确认导入。");
  }

  const generated = previewRun.aiOutput;

  if (!isRecord(generated)) {
    throw new Error("预览批次缺少 AI 输出，请重新生成。");
  }

  const selectedBatch = batch ?? (generated as unknown as AdminImportBatch);
  const validation = await validateGeneratedAdminImport(selectedBatch);

  if (!validation.ok) {
    const importRun = await markAdminImportRunValidationFailed({
      id: previewRun.id,
      validationErrors: validation.errors,
      aiOutput: selectedBatch,
    });

    return {
      status: "validation_failed" as const,
      importRun,
      errors: validation.errors,
    };
  }

  const dedupeWarnings = await findAdminImportDedupeWarnings(validation.batch);

  if (dedupeWarnings.length > 0 && !allowDedupeOverride) {
    throw new Error("发现疑似重复知识，确认仍然导入后才能保存。");
  }

  const importRun = await saveAdminImportBatch({
    adminUserId,
    sourceTitle: previewRun.sourceTitle ?? undefined,
    sourceExcerpt: previewRun.sourceExcerpt,
    batch: validation.batch,
    aiOutput: validation.batch,
    importRunId: previewRun.id,
  });

  return {
    status: "saved" as const,
    importRun,
    savedCount: validation.batch.items.length,
    dedupeWarnings,
  };
}

export async function savePreviewedLearnerImport({
  userId,
  importRunId,
  batch,
}: {
  userId: string;
  importRunId: string;
  batch?: AdminImportBatch;
}) {
  const previewRun = await getAdminImportRunForAdmin({
    id: importRunId,
    adminUserId: userId,
  });

  if (!previewRun) {
    throw new Error("预览批次不存在。");
  }

  if (
    previewRun.status !== "validation_failed" ||
    previewRun.savedCount !== 0 ||
    !isEmptyJsonArray(previewRun.validationErrors)
  ) {
    throw new Error("只有已生成预览的批次可以确认导入。");
  }

  const generated = previewRun.aiOutput;

  if (!isRecord(generated)) {
    throw new Error("预览批次缺少 AI 输出，请重新生成。");
  }

  const selectedBatch = batch ?? (generated as unknown as AdminImportBatch);
  const validation = await validateGeneratedAdminImport(selectedBatch);

  if (!validation.ok) {
    const importRun = await markAdminImportRunValidationFailed({
      id: previewRun.id,
      validationErrors: validation.errors,
      aiOutput: selectedBatch,
    });

    return {
      status: "validation_failed" as const,
      importRun,
      errors: validation.errors,
    };
  }

  const importRun = await saveAdminImportBatch({
    adminUserId: userId,
    sourceTitle: previewRun.sourceTitle ?? undefined,
    sourceExcerpt: previewRun.sourceExcerpt,
    batch: validation.batch,
    aiOutput: validation.batch,
    importRunId: previewRun.id,
    saveScope: {
      scope: "learner",
      userId,
    },
  });

  return {
    status: "saved" as const,
    importRun,
    savedCount: validation.batch.items.length,
  };
}

export async function getRecentAdminImportRuns() {
  return listRecentAdminImportRuns(20);
}

async function validateGeneratedAdminImport(generated: AdminImportBatch) {
  const referencedSlugs = collectGeneratedImportSlugs(generated);
  const existingSlugs = await listExistingKnowledgeItemIdsBySlug(referencedSlugs);

  return validateAdminImportBatch(
    generated,
    new Set(existingSlugs.keys()),
  );
}

export async function findAdminImportDedupeWarnings(
  batch: AdminImportBatch,
): Promise<AdminImportDedupeWarning[]> {
  const domains = unique(batch.items.map((item) => item.domain).filter(Boolean));
  const existingItems = await listPublicKnowledgeItemsForImportDedupe(domains);

  return buildAdminImportDedupeWarnings({
    batch,
    existingItems,
  });
}

export function buildAdminImportDedupeWarnings({
  batch,
  existingItems,
  threshold = IMPORT_DEDUPE_THRESHOLD,
}: {
  batch: AdminImportBatch;
  existingItems: AdminImportDedupeExistingItem[];
  threshold?: number;
}): AdminImportDedupeWarning[] {
  const warnings: AdminImportDedupeWarning[] = [];

  for (const item of batch.items) {
    const generatedItem = toGeneratedDedupeScoredItem(item);

    for (const existingItem of existingItems) {
      if (!isComparableImportDedupeItem(item, existingItem)) {
        continue;
      }

      const pair = scoreKnowledgeDedupePair(
        generatedItem,
        toExistingDedupeScoredItem(existingItem),
      );

      if (pair.score < threshold) {
        continue;
      }

      warnings.push({
        generatedSlug: item.slug,
        generatedTitle: item.title,
        score: pair.score,
        reasons: pair.reasons,
        existingItem: {
          id: existingItem.id,
          slug: existingItem.slug,
          title: existingItem.title,
          domain: existingItem.domain,
          ...(existingItem.subdomain
            ? { subdomain: existingItem.subdomain }
            : {}),
          summary: existingItem.summary,
        },
      });
    }
  }

  return warnings.sort((first, second) => second.score - first.score);
}

function isComparableImportDedupeItem(
  item: AdminImportBatch["items"][number],
  existingItem: AdminImportDedupeExistingItem,
) {
  if (item.slug === existingItem.slug || item.domain !== existingItem.domain) {
    return false;
  }

  return !item.subdomain || item.subdomain === existingItem.subdomain;
}

function toGeneratedDedupeScoredItem(
  item: AdminImportBatch["items"][number],
): KnowledgeDedupeScoredItem {
  return {
    id: `generated:${item.slug}`,
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    body: item.body,
    contentType: item.contentType,
    tags: item.tags,
  };
}

function toExistingDedupeScoredItem(
  item: AdminImportDedupeExistingItem,
): KnowledgeDedupeScoredItem {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    body: item.body,
    contentType: item.contentType,
    tags: item.tags,
  };
}

export function collectGeneratedImportSlugs(input: unknown) {
  const record = isRecord(input) ? input : {};
  const items = Array.isArray(record.items) ? record.items : [];
  const relations = Array.isArray(record.relations) ? record.relations : [];

  return unique([
    ...items.flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }

      const slug = text(item.slug);

      return slug ? [slug] : [];
    }),
    ...relations.flatMap((relation) => {
      if (!isRecord(relation)) {
        return [];
      }

      return [text(relation.fromSlug), text(relation.toSlug)].filter(Boolean);
    }),
  ]);
}

function toPipelineError(
  error: unknown,
  fallbackMessage: string,
): AdminImportValidationError {
  const detail = error instanceof Error ? error.message : undefined;

  return {
    code: "invalid_render_payload",
    path: "aiOutput",
    message: detail ? `${fallbackMessage}${detail}` : fallbackMessage,
  };
}

function optionalText(value: unknown) {
  const normalized = text(value);

  return normalized || undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEmptyJsonArray(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

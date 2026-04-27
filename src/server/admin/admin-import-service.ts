import { generateAdminImportBatch } from "@/server/admin/admin-import-ai";
import {
  createAdminImportRun,
  listExistingKnowledgeItemIdsBySlug,
  listRecentAdminImportRuns,
  saveAdminImportBatch,
} from "@/server/admin/admin-import-repository";
import type { AdminImportValidationError } from "@/server/admin/admin-import-types";
import { validateAdminImportBatch } from "@/server/admin/admin-import-validation";

export type AdminImportRequest = {
  sourceMaterial: string;
  sourceTitle?: string;
  defaultDomain: string;
  defaultSubdomain?: string;
  preferredContentTypes?: string[];
};

export function normalizeAdminImportRequest(input: unknown): AdminImportRequest {
  const record = isRecord(input) ? input : {};
  const sourceMaterial = text(record.sourceMaterial);
  const defaultDomain = text(record.defaultDomain);

  if (!sourceMaterial || !defaultDomain) {
    throw new Error("素材和默认领域不能为空。");
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
    defaultDomain,
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
  const sourceExcerpt = input.sourceMaterial.slice(0, 1000);
  let generated: Awaited<ReturnType<typeof generateAdminImportBatch>>;

  try {
    generated = await generateAdminImportBatch(input);
  } catch (error) {
    const importRun = await createAdminImportRun({
      adminUserId,
      sourceTitle: input.sourceTitle,
      sourceExcerpt,
      defaultDomain: input.defaultDomain,
      status: "ai_failed",
      generatedCount: 0,
      savedCount: 0,
      validationErrors: [toPipelineError(error, "AI 生成失败，请稍后重试。")],
    });

    return { status: "ai_failed" as const, importRun };
  }

  const generatedItems = Array.isArray(generated.items) ? generated.items : [];
  const referencedSlugs = collectGeneratedImportSlugs(generated);
  const existingSlugs = await listExistingKnowledgeItemIdsBySlug(referencedSlugs);
  const validation = validateAdminImportBatch(
    generated,
    new Set(existingSlugs.keys()),
  );

  if (!validation.ok) {
    const importRun = await createAdminImportRun({
      adminUserId,
      sourceTitle: input.sourceTitle,
      sourceExcerpt,
      defaultDomain: input.defaultDomain,
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

  const importRun = await saveAdminImportBatch({
    adminUserId,
    sourceTitle: input.sourceTitle,
    sourceExcerpt,
    batch: validation.batch,
    aiOutput: generated,
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

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

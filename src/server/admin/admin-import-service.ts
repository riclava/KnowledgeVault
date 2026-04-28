import { generateAdminImportBatch } from "@/server/admin/admin-import-ai";
import {
  createAdminImportRun,
  getAdminImportRunForAdmin,
  listExistingKnowledgeItemIdsBySlug,
  listRecentAdminImportRuns,
  markAdminImportRunValidationFailed,
  saveAdminImportBatch,
} from "@/server/admin/admin-import-repository";
import type {
  AdminImportBatch,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";
import { validateAdminImportBatch } from "@/server/admin/admin-import-validation";

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
    };

type GeneratedAdminImportBatch = Awaited<ReturnType<typeof generateAdminImportBatch>>;

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
}: {
  adminUserId: string;
  input: AdminImportRequest;
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

  const importRun = await createAdminImportRun({
    adminUserId,
    sourceTitle: input.sourceTitle,
    sourceExcerpt,
    defaultDomain: input.defaultDomain ?? generated.defaultDomain ?? "",
    status: "validation_failed",
    generatedCount: validation.batch.items.length,
    savedCount: 0,
    validationErrors: [],
    aiOutput: generated,
  });

  return {
    status: "previewed" as const,
    importRun,
    generatedCount: validation.batch.items.length,
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
  });

  return preview;
}

export async function savePreviewedAdminImport({
  adminUserId,
  importRunId,
}: {
  adminUserId: string;
  importRunId: string;
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

  const validation = await validateGeneratedAdminImport(
    generated as unknown as AdminImportBatch,
  );

  if (!validation.ok) {
    const importRun = await markAdminImportRunValidationFailed({
      id: previewRun.id,
      validationErrors: validation.errors,
    });

    return {
      status: "validation_failed" as const,
      importRun,
      errors: validation.errors,
    };
  }

  const importRun = await saveAdminImportBatch({
    adminUserId,
    sourceTitle: previewRun.sourceTitle ?? undefined,
    sourceExcerpt: previewRun.sourceExcerpt,
    batch: validation.batch,
    aiOutput: generated,
    importRunId: previewRun.id,
  });

  return {
    status: "saved" as const,
    importRun,
    savedCount: validation.batch.items.length,
  };
}

export async function savePreviewedLearnerImport({
  userId,
  importRunId,
}: {
  userId: string;
  importRunId: string;
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

  const validation = await validateGeneratedAdminImport(
    generated as unknown as AdminImportBatch,
  );

  if (!validation.ok) {
    const importRun = await markAdminImportRunValidationFailed({
      id: previewRun.id,
      validationErrors: validation.errors,
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
    aiOutput: generated,
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

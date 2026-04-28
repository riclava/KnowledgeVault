"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

type ImportResult = unknown;

type ImportSummary = {
  status: string;
  statusLabel: string;
  generatedCount: number;
  savedCount: number;
  reviewItemCount: number;
  relationCount: number;
  errorMessages: string[];
  sourceTitle: string;
  defaultDomain: string;
  importRunId: string;
};

type PreviewVariable = {
  symbol: string;
  name: string;
  description: string;
  unit: string;
};

type PreviewReviewItem = {
  type: string;
  prompt: string;
  answer: string;
  explanation: string;
  difficulty: number;
};

type PreviewKnowledgeItem = {
  slug: string;
  title: string;
  contentType: string;
  renderPayload: unknown;
  domain: string;
  subdomain: string;
  summary: string;
  body: string;
  intuition: string;
  deepDive: string;
  useConditions: string[];
  nonUseConditions: string[];
  antiPatterns: string[];
  typicalProblems: string[];
  examples: string[];
  tags: string[];
  difficulty: number;
  variables: PreviewVariable[];
  reviewItems: PreviewReviewItem[];
};

type PreviewRelation = {
  fromSlug: string;
  toSlug: string;
  relationType: string;
  note: string;
};

type AdminImportFormProps = {
  endpoint?: string;
  sourceMaterialDescription?: string;
  confirmHint?: string;
  successTitle?: string;
};

const CONTENT_TYPE_OPTIONS = [
  { value: "concept_card", label: "概念卡" },
  { value: "procedure", label: "流程" },
  { value: "comparison_table", label: "对比表" },
  { value: "math_formula", label: "公式" },
  { value: "vocabulary", label: "词汇" },
  { value: "plain_text", label: "纯文本" },
] as const;

export function AdminImportForm({
  endpoint = "/api/admin/import",
  sourceMaterialDescription = "粘贴教材、笔记、文章或题目，AI 先生成可检查的预览，确认后再写入知识库。",
  confirmHint = "确认预览内容没问题后，再写入知识库。",
  successTitle = "导入完成",
}: AdminImportFormProps = {}) {
  const [result, setResult] = useState<ImportResult>(null);
  const [isPending, startTransition] = useTransition();
  const summary = useMemo(() => getImportSummary(result), [result]);
  const previewItems = useMemo(() => getImportPreviewItems(result), [result]);
  const previewRelations = useMemo(() => getImportPreviewRelations(result), [result]);
  const canConfirmImport =
    summary.status === "previewed" &&
    Boolean(summary.importRunId) &&
    summary.errorMessages.length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildPreviewPayload(new FormData(event.currentTarget));

    startTransition(async () => {
      setResult(null);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? `预览生成失败：${response.status}`);
          return;
        }

        setResult(responseBody);

        const nextSummary = getImportSummary(responseBody);

        if (nextSummary.status === "previewed") {
          toast.success("预览已生成");
        } else if (nextSummary.status === "validation_failed") {
          toast.error("预览校验未通过，请查看需要调整的内容。");
        } else {
          toast.error(nextSummary.statusLabel);
        }
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "预览生成失败。");
      }
    });
  }

  function handleConfirmImport() {
    if (!summary.importRunId) {
      toast.error("缺少预览批次，无法导入。");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "save",
            importRunId: summary.importRunId,
          }),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? `导入失败：${response.status}`);
          return;
        }

        setResult(responseBody);

        const nextSummary = getImportSummary(responseBody);

        if (nextSummary.status === "saved") {
          toast.success("导入完成");
        } else if (nextSummary.status === "validation_failed") {
          toast.error("导入前校验未通过，请重新生成预览。");
        } else {
          toast.error(nextSummary.statusLabel);
        }
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "导入请求失败。");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm"
    >
      <div className="grid gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <Label htmlFor="sourceMaterial">来源材料</Label>
            <p className="text-sm text-muted-foreground">
              {sourceMaterialDescription}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            AI 自动判断
          </Badge>
        </div>
        <Textarea
          id="sourceMaterial"
          name="sourceMaterial"
          required
          className="min-h-44 resize-y text-sm leading-6"
          placeholder="把要导入的内容粘贴到这里..."
        />
      </div>

      <details className="group rounded-lg border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
          高级设置
          <span className="text-xs font-normal text-muted-foreground">
            留空时 AI 自动判断
          </span>
        </summary>
        <div className="grid gap-4 border-t bg-background/70 p-3">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_14rem]">
            <div className="grid gap-2">
              <Label htmlFor="sourceTitle">来源标题</Label>
              <Input
                id="sourceTitle"
                name="sourceTitle"
                placeholder="留空自动生成"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultDomain">默认领域</Label>
              <Input
                id="defaultDomain"
                name="defaultDomain"
                placeholder="留空自动判断"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultSubdomain">默认子领域</Label>
              <Input
                id="defaultSubdomain"
                name="defaultSubdomain"
                placeholder="留空自动判断"
              />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">偏好内容类型</legend>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm transition-colors hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    name="preferredContentTypes"
                    value={option.value}
                    className="size-4 accent-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {result ? (
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            重新生成
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              AI 整理中...
            </>
          ) : (
            <>
              <Sparkles />
              生成预览
            </>
          )}
        </Button>
      </div>

      {result ? (
        <section className="grid gap-3 rounded-lg border border-success/25 bg-success/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1">
              <h2 className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="size-4" />
                {summary.status === "saved" ? successTitle : "预览已生成"}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {summary.sourceTitle} · {summary.defaultDomain} · {summary.statusLabel}
              </p>
            </div>
            {summary.importRunId ? (
              <p className="text-xs text-muted-foreground">
                批次：{summary.importRunId}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <ResultMetric
              label="知识项"
              value={summary.status === "saved" ? summary.savedCount : summary.generatedCount}
            />
            <ResultMetric label="复习题" value={summary.reviewItemCount} />
            <ResultMetric label="关系" value={summary.relationCount} />
          </div>

          {summary.errorMessages.length > 0 ? (
            <div className="rounded-md border border-warning/30 bg-background/70 px-3 py-2 text-sm text-warning">
              <p className="font-medium">需要调整：</p>
              <ul className="mt-1 grid gap-1">
                {summary.errorMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.status !== "saved" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background/75 px-3 py-2">
              <p className="text-sm text-muted-foreground">
                {confirmHint}
              </p>
              <Button
                type="button"
                disabled={isPending || !canConfirmImport}
                onClick={handleConfirmImport}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                确认导入
              </Button>
            </div>
          ) : null}

          <details open className="rounded-lg border bg-background/80">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              结构化预览
            </summary>
            <div className="grid gap-4 border-t p-3">
              {previewItems.length > 0 ? (
                previewItems.map((item, index) => (
                  <PreviewKnowledgeItemCard
                    key={item.slug || `${item.title}-${index}`}
                    item={item}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  暂无可预览的知识项。
                </p>
              )}

              {previewRelations.length > 0 ? (
                <section className="grid gap-2 rounded-md border bg-background/75 p-3">
                  <h3 className="text-sm font-semibold">知识关系</h3>
                  <ul className="grid gap-2 text-sm">
                    {previewRelations.map((relation, index) => (
                      <li
                        key={`${relation.fromSlug}-${relation.toSlug}-${relation.relationType}-${index}`}
                        className="rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <span className="font-medium">{relation.fromSlug}</span>
                        <span className="px-2 text-muted-foreground">
                          {relation.relationType}
                        </span>
                        <span className="font-medium">{relation.toSlug}</span>
                        {relation.note ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {relation.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </details>
        </section>
      ) : null}
    </form>
  );
}

function PreviewKnowledgeItemCard({ item }: { item: PreviewKnowledgeItem }) {
  return (
    <article className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h3 className="text-base font-semibold">{item.title || item.slug}</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {item.summary || item.body}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{labelForContentType(item.contentType)}</Badge>
          <Badge variant="outline">{item.domain || "未分领域"}</Badge>
          {item.subdomain ? <Badge variant="outline">{item.subdomain}</Badge> : null}
          <Badge variant="outline">难度 {item.difficulty || 1}</Badge>
        </div>
      </div>

      <RenderPayloadPreview
        contentType={item.contentType}
        payload={item.renderPayload}
      />

      {item.body ? (
        <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
      ) : null}

      <PreviewTextList title="使用条件" values={item.useConditions} />
      <PreviewTextList title="易错点" values={item.antiPatterns} />

      {item.variables.length > 0 ? (
        <section className="grid gap-2">
          <h4 className="text-sm font-medium">变量</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {item.variables.map((variable) => (
              <div
                key={`${variable.symbol}-${variable.name}`}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="font-medium">{variable.symbol}</span>
                <span className="text-muted-foreground"> · {variable.name}</span>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {variable.description}
                  {variable.unit ? `（${variable.unit}）` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {item.reviewItems.length > 0 ? (
        <section className="grid gap-2">
          <h4 className="text-sm font-medium">复习题</h4>
          <div className="grid gap-2">
            {item.reviewItems.map((reviewItem, index) => (
              <div
                key={`${reviewItem.type}-${reviewItem.prompt}-${index}`}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{reviewItem.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    难度 {reviewItem.difficulty || 1}
                  </span>
                </div>
                <p className="mt-2 font-medium">{reviewItem.prompt}</p>
                <p className="mt-1 text-muted-foreground">{reviewItem.answer}</p>
                {reviewItem.explanation ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {reviewItem.explanation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RenderPayloadPreview({
  contentType,
  payload,
}: {
  contentType: string;
  payload: unknown;
}) {
  if (!isKnowledgeItemType(contentType)) {
    return (
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        暂不支持预览类型：{contentType || "unknown"}
      </p>
    );
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <KnowledgeItemRenderer
        contentType={contentType}
        payload={payload as KnowledgeItemRenderPayloadByType[KnowledgeItemType]}
        block
      />
    </div>
  );
}

function PreviewTextList({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="grid gap-1 text-sm leading-6 text-muted-foreground">
        {values.map((value) => (
          <li key={value} className="rounded-md bg-muted/30 px-3 py-1.5">
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildPreviewPayload(formData: FormData) {
  const preferredContentTypes = formData
    .getAll("preferredContentTypes")
    .map((value) => String(value).trim())
    .filter(Boolean);

  return {
    mode: "preview",
    sourceTitle: String(formData.get("sourceTitle") ?? ""),
    defaultDomain: String(formData.get("defaultDomain") ?? ""),
    defaultSubdomain: String(formData.get("defaultSubdomain") ?? ""),
    sourceMaterial: String(formData.get("sourceMaterial") ?? ""),
    preferredContentTypes,
  };
}

function getImportPreviewItems(result: unknown): PreviewKnowledgeItem[] {
  const data = getRecord(getRecord(result)?.data) ?? getRecord(result);
  const importRun = getRecord(data?.importRun);
  const aiOutput = getRecord(importRun?.aiOutput) ?? getRecord(data?.aiOutput);
  const items = Array.isArray(aiOutput?.items) ? aiOutput.items : [];

  return items.flatMap((item) => {
    const record = getRecord(item);

    if (!record) {
      return [];
    }

    return [{
      slug: textValue(record.slug),
      title: textValue(record.title),
      contentType: textValue(record.contentType),
      renderPayload: record.renderPayload,
      domain: textValue(record.domain),
      subdomain: textValue(record.subdomain),
      summary: textValue(record.summary),
      body: textValue(record.body),
      intuition: textValue(record.intuition),
      deepDive: textValue(record.deepDive),
      useConditions: arrayStrings(record.useConditions),
      nonUseConditions: arrayStrings(record.nonUseConditions),
      antiPatterns: arrayStrings(record.antiPatterns),
      typicalProblems: arrayStrings(record.typicalProblems),
      examples: arrayStrings(record.examples),
      tags: arrayStrings(record.tags),
      difficulty: numberValue(record.difficulty) || 1,
      variables: getPreviewVariables(record.variables),
      reviewItems: getPreviewReviewItems(record.reviewItems),
    }];
  });
}

function getImportPreviewRelations(result: unknown): PreviewRelation[] {
  const data = getRecord(getRecord(result)?.data) ?? getRecord(result);
  const importRun = getRecord(data?.importRun);
  const aiOutput = getRecord(importRun?.aiOutput) ?? getRecord(data?.aiOutput);
  const relations = Array.isArray(aiOutput?.relations) ? aiOutput.relations : [];

  return relations.flatMap((relation) => {
    const record = getRecord(relation);

    if (!record) {
      return [];
    }

    return [{
      fromSlug: textValue(record.fromSlug),
      toSlug: textValue(record.toSlug),
      relationType: textValue(record.relationType),
      note: textValue(record.note),
    }];
  });
}

function getPreviewVariables(value: unknown): PreviewVariable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((variable) => {
    const record = getRecord(variable);

    if (!record) {
      return [];
    }

    return [{
      symbol: textValue(record.symbol),
      name: textValue(record.name),
      description: textValue(record.description),
      unit: textValue(record.unit),
    }];
  });
}

function getPreviewReviewItems(value: unknown): PreviewReviewItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((reviewItem) => {
    const record = getRecord(reviewItem);

    if (!record) {
      return [];
    }

    return [{
      type: textValue(record.type),
      prompt: textValue(record.prompt),
      answer: textValue(record.answer),
      explanation: textValue(record.explanation),
      difficulty: numberValue(record.difficulty) || 1,
    }];
  });
}

function ResultMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background/75 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function getResponseError(responseBody: unknown) {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
  ) {
    return responseBody.error;
  }

  return null;
}

function getImportSummary(result: unknown): ImportSummary {
  const data = getRecord(getRecord(result)?.data) ?? getRecord(result);
  const importRun = getRecord(data?.importRun);
  const aiOutput = getRecord(importRun?.aiOutput) ?? getRecord(data?.aiOutput);
  const items = Array.isArray(aiOutput?.items) ? aiOutput.items : [];
  const relations = Array.isArray(aiOutput?.relations) ? aiOutput.relations : [];
  const status = typeof data?.status === "string" ? data.status : "unknown";
  const generatedCount = numberValue(importRun?.generatedCount) || items.length;
  const savedCount =
    numberValue(data?.savedCount) || numberValue(importRun?.savedCount);
  const errors = Array.isArray(data?.errors)
    ? data.errors
    : Array.isArray(importRun?.validationErrors)
      ? importRun.validationErrors
      : [];

  return {
    status,
    statusLabel: statusLabel(status),
    generatedCount,
    savedCount,
    reviewItemCount: countReviewItems(items),
    relationCount: relations.length,
    errorMessages: errors.map(formatValidationError).slice(0, 5),
    sourceTitle:
      textValue(importRun?.sourceTitle) ||
      textValue(aiOutput?.sourceTitle) ||
      "未命名来源",
    defaultDomain:
      textValue(importRun?.defaultDomain) ||
      textValue(aiOutput?.defaultDomain) ||
      "AI 自动判断",
    importRunId: typeof importRun?.id === "string" ? importRun.id : "",
  };
}

function countReviewItems(items: unknown[]): number {
  let count = 0;

  for (const item of items) {
    const record = getRecord(item);
    const reviewItems = Array.isArray(record?.reviewItems)
      ? record.reviewItems
      : [];

    count += reviewItems.length;
  }

  return count;
}

function formatValidationError(error: unknown) {
  const record = getRecord(error);
  const path = textValue(record?.path);
  const message = textValue(record?.message);

  if (path && message) {
    return `${path}: ${message}`;
  }

  return message || "AI 输出需要调整。";
}

function statusLabel(status: string) {
  if (status === "previewed") {
    return "待确认";
  }

  if (status === "saved") {
    return "已保存";
  }

  if (status === "validation_failed") {
    return "校验未通过";
  }

  if (status === "ai_failed") {
    return "AI 生成失败";
  }

  return status;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayStrings(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => String(entry).trim())
        .filter(Boolean)
    : [];
}

function isKnowledgeItemType(value: string): value is KnowledgeItemType {
  return CONTENT_TYPE_OPTIONS.some((option) => option.value === value);
}

function labelForContentType(value: string) {
  return CONTENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

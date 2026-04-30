"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  questionCount: number;
  relationCount: number;
  errorMessages: string[];
  sourceTitle: string;
  defaultDomain: string;
  importRunId: string;
};

type PreviewQuestion = {
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
  tags: string[];
  tagsInput?: string;
  difficulty: number;
  questions: PreviewQuestion[];
};

type PreviewRelation = {
  fromSlug: string;
  toSlug: string;
  relationType: string;
  note: string;
};

type PreviewImportBatch = {
  sourceTitle?: string;
  defaultDomain?: string;
  items: PreviewKnowledgeItem[];
  relations: PreviewRelation[];
};

type PreviewDedupeWarning = {
  generatedSlug: string;
  generatedTitle: string;
  score: number;
  reasons: {
    kind: string;
    score: number;
    detail: string;
  }[];
  existingItem: {
    id: string;
    slug: string;
    title: string;
    domain: string;
    subdomain: string;
    summary: string;
  };
};

type PreviewKnowledgeItemField =
  | "slug"
  | "title"
  | "domain"
  | "subdomain"
  | "summary"
  | "difficulty"
  | "tags";

type PreviewRelationField =
  | "fromSlug"
  | "toSlug"
  | "relationType"
  | "note";

type ImportDomainOptions = {
  domains: string[];
  subdomainsByDomain: Record<string, string[]>;
};

type AdminImportFormProps = {
  endpoint?: string;
  sourceMaterialDescription?: string;
  confirmHint?: string;
  successTitle?: string;
  domainOptions?: ImportDomainOptions;
};

const CONTENT_TYPE_OPTIONS = [
  { value: "concept_card", label: "概念卡" },
  { value: "procedure", label: "流程" },
  { value: "comparison_table", label: "对比表" },
  { value: "math_formula", label: "公式" },
  { value: "vocabulary", label: "词汇" },
  { value: "plain_text", label: "纯文本" },
] as const;

const RELATION_TYPE_OPTIONS = [
  { value: "prerequisite", label: "前置知识" },
  { value: "related", label: "相关" },
  { value: "confusable", label: "易混淆" },
  { value: "application_of", label: "应用于" },
] as const;
const SELECT_EXISTING_OPTION_VALUE = "__select_existing_option__";

export function AdminImportForm({
  endpoint = "/api/admin/import",
  sourceMaterialDescription = "粘贴教材、笔记、文章或题目，AI 先生成可检查的预览，确认后再写入知识库。",
  confirmHint = "确认预览内容没问题后，再写入知识库。",
  successTitle = "导入完成",
  domainOptions = { domains: [], subdomainsByDomain: {} },
}: AdminImportFormProps = {}) {
  const [result, setResult] = useState<ImportResult>(null);
  const [editableBatch, setEditableBatch] =
    useState<PreviewImportBatch | null>(null);
  const [allowDedupeOverride, setAllowDedupeOverride] = useState(false);
  const [isPending, startTransition] = useTransition();
  const summary = useMemo(() => getImportSummary(result), [result]);
  const generatedPreviewItems = useMemo(() => getImportPreviewItems(result), [result]);
  const generatedPreviewRelations = useMemo(() => getImportPreviewRelations(result), [result]);
  const dedupeWarnings = useMemo(() => getImportDedupeWarnings(result), [result]);
  const hasDedupeWarnings = dedupeWarnings.length > 0;
  const previewItems = editableBatch?.items ?? generatedPreviewItems;
  const previewRelations = editableBatch?.relations ?? generatedPreviewRelations;
  const previewSummary = {
    ...summary,
    generatedCount: editableBatch?.items.length ?? summary.generatedCount,
    questionCount: editableBatch
      ? countQuestions(editableBatch.items)
      : summary.questionCount,
    relationCount: editableBatch?.relations.length ?? summary.relationCount,
    sourceTitle: editableBatch?.sourceTitle || summary.sourceTitle,
    defaultDomain: editableBatch?.defaultDomain || summary.defaultDomain,
  };
  const isPreviewEditable = previewSummary.status !== "saved";
  const canConfirmImport =
    (previewSummary.status === "previewed" ||
      previewSummary.status === "validation_failed") &&
    Boolean(previewSummary.importRunId) &&
    Boolean(editableBatch) &&
    (!hasDedupeWarnings || allowDedupeOverride);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildPreviewPayload(new FormData(event.currentTarget));

    startTransition(async () => {
      setResult(null);
      setEditableBatch(null);
      setAllowDedupeOverride(false);

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
        setEditableBatch(getImportPreviewBatch(responseBody));

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
    if (!previewSummary.importRunId) {
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
            importRunId: previewSummary.importRunId,
            batch: editableBatch,
            allowDedupeOverride,
          }),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? `导入失败：${response.status}`);
          return;
        }

        setResult(responseBody);
        setEditableBatch(getImportPreviewBatch(responseBody) ?? editableBatch);
        setAllowDedupeOverride(false);

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

  function updatePreviewItemField(
    index: number,
    field: PreviewKnowledgeItemField,
    value: string | number,
  ) {
    setEditableBatch((current) => {
      if (!current) {
        return current;
      }

      setAllowDedupeOverride(false);

      return {
        ...current,
        items: current.items.map((item, itemIndex) =>
          itemIndex === index
            ? updatePreviewItemValue(item, field, value)
            : item,
        ),
      };
    });
  }

  function updatePreviewRelationField(
    index: number,
    field: PreviewRelationField,
    value: string,
  ) {
    setEditableBatch((current) => {
      if (!current) {
        return current;
      }

      setAllowDedupeOverride(false);

      return {
        ...current,
        relations: current.relations.map((relation, relationIndex) =>
          relationIndex === index
            ? { ...relation, [field]: value }
            : relation,
        ),
      };
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
                {previewSummary.status === "saved" ? successTitle : "预览已生成"}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {previewSummary.sourceTitle} · {previewSummary.defaultDomain} · {previewSummary.statusLabel}
              </p>
            </div>
            {previewSummary.importRunId ? (
              <p className="text-xs text-muted-foreground">
                批次：{previewSummary.importRunId}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <ResultMetric
              label="知识项"
              value={previewSummary.status === "saved" ? previewSummary.savedCount : previewSummary.generatedCount}
            />
            <ResultMetric label="复习题" value={previewSummary.questionCount} />
            <ResultMetric label="关系" value={previewSummary.relationCount} />
          </div>

          {previewSummary.errorMessages.length > 0 ? (
            <div className="rounded-md border border-warning/30 bg-background/70 px-3 py-2 text-sm text-warning">
              <p className="font-medium">需要调整：</p>
              <ul className="mt-1 grid gap-1">
                {previewSummary.errorMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasDedupeWarnings ? (
            <ImportDedupeWarningPanel warnings={dedupeWarnings} />
          ) : null}

          {previewSummary.status !== "saved" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background/75 px-3 py-2">
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  {confirmHint}
                </p>
                {hasDedupeWarnings ? (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowDedupeOverride}
                      className="size-4 accent-primary"
                      onChange={(event) =>
                        setAllowDedupeOverride(event.currentTarget.checked)
                      }
                    />
                    仍然导入这些疑似重复知识
                  </label>
                ) : null}
              </div>
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
                    index={index}
                    disabled={!isPreviewEditable}
                    domainOptions={domainOptions}
                    dedupeWarnings={dedupeWarnings.filter(
                      (warning) => warning.generatedSlug === item.slug,
                    )}
                    onFieldChange={(field, value) =>
                      updatePreviewItemField(index, field, value)
                    }
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
                      <PreviewRelationListItem
                        key={`${relation.fromSlug}-${relation.toSlug}-${relation.relationType}-${index}`}
                        relation={relation}
                        index={index}
                        disabled={!isPreviewEditable}
                        onFieldChange={(field, value) =>
                          updatePreviewRelationField(index, field, value)
                        }
                      />
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

function PreviewKnowledgeItemCard({
  item,
  index,
  disabled,
  domainOptions,
  dedupeWarnings,
  onFieldChange,
}: {
  item: PreviewKnowledgeItem;
  index: number;
  disabled: boolean;
  domainOptions: ImportDomainOptions;
  dedupeWarnings: PreviewDedupeWarning[];
  onFieldChange: (
    field: PreviewKnowledgeItemField,
    value: string | number,
  ) => void;
}) {
  const subdomainOptions = subdomainOptionsForDomain(domainOptions, item.domain);
  const subdomainSelectOptions =
    subdomainOptions.length > 0
      ? subdomainOptions
      : allSubdomainOptions(domainOptions);

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

      {dedupeWarnings.length > 0 ? (
        <div className="grid gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle className="size-4" />
            疑似重复
          </div>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {dedupeWarnings.map((warning) => (
              <li key={`${warning.generatedSlug}-${warning.existingItem.id}`}>
                与「{warning.existingItem.title}」相似度 {formatPercent(warning.score)}
                <span className="ml-1 text-xs">
                  ({warning.existingItem.slug})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <PreviewInput
            id={`preview-${index}-title`}
            label="标题"
            name="title"
            value={item.title}
            disabled={disabled}
            onChange={(value) => onFieldChange("title", value)}
          />
          <PreviewInput
            id={`preview-${index}-slug`}
            label="Slug"
            name="slug"
            value={item.slug}
            disabled={disabled}
            onChange={(value) => onFieldChange("slug", value)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
          <PreviewInput
            id={`preview-${index}-domain`}
            label="领域"
            name="domain"
            value={item.domain}
            disabled={disabled}
            options={domainOptions.domains}
            selectLabel="选择已有领域"
            onChange={(value) => onFieldChange("domain", value)}
          />
          <PreviewInput
            id={`preview-${index}-subdomain`}
            label="子领域"
            name="subdomain"
            value={item.subdomain}
            disabled={disabled}
            options={subdomainSelectOptions}
            selectLabel="选择已有子领域"
            onChange={(value) => onFieldChange("subdomain", value)}
          />
          <div className="grid gap-2">
            <Label htmlFor={`preview-${index}-difficulty`}>难度</Label>
            <Input
              id={`preview-${index}-difficulty`}
              name="difficulty"
              type="number"
              min={1}
              max={5}
              value={item.difficulty}
              disabled={disabled}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                }
              }}
              onChange={(event) =>
                onFieldChange("difficulty", Number(event.currentTarget.value) || 1)
              }
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="grid gap-2">
            <Label htmlFor={`preview-${index}-summary`}>摘要</Label>
            <Textarea
              id={`preview-${index}-summary`}
              name="summary"
              value={item.summary}
              disabled={disabled}
              className="min-h-20 resize-y"
              onChange={(event) => onFieldChange("summary", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`preview-${index}-tags`}>
              标签（逗号或换行分隔）
            </Label>
            <Textarea
              id={`preview-${index}-tags`}
              name="tags"
              value={item.tagsInput ?? item.tags.join("\n")}
              disabled={disabled}
              className="min-h-20 resize-y"
              onChange={(event) =>
                onFieldChange("tags", event.currentTarget.value)
              }
            />
          </div>
        </div>
      </div>

      <RenderPayloadPreview
        contentType={item.contentType}
        payload={item.renderPayload}
      />

      {item.body ? (
        <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
      ) : null}

      {item.questions.length > 0 ? (
        <section className="grid gap-2">
          <h4 className="text-sm font-medium">复习题</h4>
          <div className="grid gap-2">
            {item.questions.map((question, index) => (
              <div
                key={`${question.type}-${question.prompt}-${index}`}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{question.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    难度 {question.difficulty || 1}
                  </span>
                </div>
                <p className="mt-2 font-medium">{question.prompt}</p>
                <p className="mt-1 text-muted-foreground">{question.answer}</p>
                {question.explanation ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {question.explanation}
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

function PreviewRelationListItem({
  relation,
  index,
  disabled,
  onFieldChange,
}: {
  relation: PreviewRelation;
  index: number;
  disabled: boolean;
  onFieldChange: (field: PreviewRelationField, value: string) => void;
}) {
  return (
    <li className="grid gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
        <PreviewInput
          id={`preview-relation-${index}-from`}
          label="来源"
          name="fromSlug"
          value={relation.fromSlug}
          disabled={disabled}
          onChange={(value) => onFieldChange("fromSlug", value)}
        />
        <div className="grid gap-2">
          <Label htmlFor={`preview-relation-${index}-type`}>关系</Label>
          <Select
            id={`preview-relation-${index}-type`}
            name="relationType"
            value={relation.relationType}
            disabled={disabled}
            onValueChange={(value) => {
              if (value) onFieldChange("relationType", value);
            }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RELATION_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <PreviewInput
          id={`preview-relation-${index}-to`}
          label="目标"
          name="toSlug"
          value={relation.toSlug}
          disabled={disabled}
          onChange={(value) => onFieldChange("toSlug", value)}
        />
      </div>
      <PreviewInput
        id={`preview-relation-${index}-note`}
        label="备注"
        name="note"
        value={relation.note}
        disabled={disabled}
        onChange={(value) => onFieldChange("note", value)}
      />
    </li>
  );
}

function ImportDedupeWarningPanel({
  warnings,
}: {
  warnings: PreviewDedupeWarning[];
}) {
  const groupedWarnings = groupDedupeWarningsByGeneratedSlug(warnings);

  return (
    <section className="grid gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-medium text-warning">
        <AlertTriangle className="size-4" />
        疑似重复知识
      </div>
      <ul className="grid gap-2 text-sm text-muted-foreground">
        {groupedWarnings.map((group) => (
          <li key={group.generatedSlug} className="grid gap-1">
            <span className="font-medium text-foreground">
              {group.generatedTitle || group.generatedSlug}
            </span>
            {group.warnings.map((warning) => (
              <span key={`${warning.generatedSlug}-${warning.existingItem.id}`}>
                与存量「{warning.existingItem.title}」相似度 {formatPercent(warning.score)}
                <span className="ml-1 text-xs">
                  ({warning.existingItem.domain}
                  {warning.existingItem.subdomain
                    ? ` / ${warning.existingItem.subdomain}`
                    : ""}
                  · {warning.existingItem.slug})
                </span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewInput({
  id,
  label,
  name,
  value,
  disabled,
  options,
  selectLabel,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  disabled: boolean;
  options?: string[];
  selectLabel?: string;
  onChange: (value: string) => void;
}) {
  const hasOptions = Boolean(options?.length);
  const showsSelect = Boolean(selectLabel);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        className={
          showsSelect
            ? "grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]"
            : "grid gap-2"
        }
      >
        <Input
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        {showsSelect ? (
          <Select
            aria-label={selectLabel ?? label}
            value={SELECT_EXISTING_OPTION_VALUE}
            disabled={disabled || !hasOptions}
            onValueChange={(nextValue) => {
              if (nextValue && nextValue !== SELECT_EXISTING_OPTION_VALUE) {
                onChange(nextValue);
              }
            }}
          >
            <SelectTrigger className="h-10 min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={SELECT_EXISTING_OPTION_VALUE}>
                  {hasOptions ? "从存量选择" : "暂无存量可选"}
                </SelectItem>
                {options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
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

function getImportPreviewBatch(result: unknown): PreviewImportBatch | null {
  const data = getRecord(getRecord(result)?.data) ?? getRecord(result);
  const importRun = getRecord(data?.importRun);
  const aiOutput = getRecord(importRun?.aiOutput) ?? getRecord(data?.aiOutput);

  if (!aiOutput) {
    return null;
  }

  return {
    sourceTitle: textValue(aiOutput.sourceTitle),
    defaultDomain: textValue(aiOutput.defaultDomain),
    items: getImportPreviewItems(result),
    relations: getImportPreviewRelations(result),
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
      tags: arrayStrings(record.tags),
      tagsInput: arrayStrings(record.tags).join("\n"),
      difficulty: numberValue(record.difficulty) || 1,
      questions: getPreviewQuestions(record.questions),
    }];
  });
}

function getImportDedupeWarnings(result: unknown): PreviewDedupeWarning[] {
  const data = getRecord(getRecord(result)?.data) ?? getRecord(result);
  const warnings = Array.isArray(data?.dedupeWarnings)
    ? data.dedupeWarnings
    : [];

  return warnings.flatMap((warning) => {
    const record = getRecord(warning);
    const existingItem = getRecord(record?.existingItem);

    if (!record || !existingItem) {
      return [];
    }

    return [{
      generatedSlug: textValue(record.generatedSlug),
      generatedTitle: textValue(record.generatedTitle),
      score: numberValue(record.score),
      reasons: getDedupeWarningReasons(record.reasons),
      existingItem: {
        id: textValue(existingItem.id),
        slug: textValue(existingItem.slug),
        title: textValue(existingItem.title),
        domain: textValue(existingItem.domain),
        subdomain: textValue(existingItem.subdomain),
        summary: textValue(existingItem.summary),
      },
    }];
  });
}

function getDedupeWarningReasons(value: unknown) {
  const reasons = Array.isArray(value) ? value : [];

  return reasons.flatMap((reason) => {
    const record = getRecord(reason);

    if (!record) {
      return [];
    }

    return [{
      kind: textValue(record.kind),
      score: numberValue(record.score),
      detail: textValue(record.detail),
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

function getPreviewQuestions(value: unknown): PreviewQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((question) => {
    const record = getRecord(question);

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
    questionCount: countQuestions(items),
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

function countQuestions(items: unknown[]): number {
  let count = 0;

  for (const item of items) {
    const record = getRecord(item);
    const questions = Array.isArray(record?.questions)
      ? record.questions
      : [];

    count += questions.length;
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

function splitListInput(value: string) {
  return value
    .split(/[\n,，]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function updatePreviewItemValue(
  item: PreviewKnowledgeItem,
  field: PreviewKnowledgeItemField,
  value: string | number,
): PreviewKnowledgeItem {
  if (field === "tags" && typeof value === "string") {
    return {
      ...item,
      tags: splitListInput(value),
      tagsInput: value,
    };
  }

  return { ...item, [field]: value };
}

function subdomainOptionsForDomain(
  domainOptions: ImportDomainOptions,
  domain: string,
) {
  return domainOptions.subdomainsByDomain[domain] ?? [];
}

function allSubdomainOptions(domainOptions: ImportDomainOptions) {
  return Array.from(
    new Set(Object.values(domainOptions.subdomainsByDomain).flat()),
  );
}

function isKnowledgeItemType(value: string): value is KnowledgeItemType {
  return CONTENT_TYPE_OPTIONS.some((option) => option.value === value);
}

function labelForContentType(value: string) {
  return CONTENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function groupDedupeWarningsByGeneratedSlug(warnings: PreviewDedupeWarning[]) {
  const groups = new Map<
    string,
    {
      generatedSlug: string;
      generatedTitle: string;
      warnings: PreviewDedupeWarning[];
    }
  >();

  for (const warning of warnings) {
    const group = groups.get(warning.generatedSlug) ?? {
      generatedSlug: warning.generatedSlug,
      generatedTitle: warning.generatedTitle,
      warnings: [],
    };

    group.warnings.push(warning);
    groups.set(warning.generatedSlug, group);
  }

  return Array.from(groups.values());
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

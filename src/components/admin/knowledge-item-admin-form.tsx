"use client";

import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { KnowledgeItemDeleteButton } from "@/components/admin/knowledge-item-delete-button";
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
import { cn } from "@/lib/utils";

type KnowledgeItemAdminFormProps = {
  initialValue?: Record<string, unknown>;
  endpoint: string;
  deleteEndpoint?: string;
  method: "POST" | "PUT";
  mode?: "create" | "edit";
};

const CONTENT_TYPE_OPTIONS = [
  {
    value: "plain_text",
    label: "纯文本",
    description: "适合定义、原则、短知识点。",
  },
  {
    value: "concept_card",
    label: "概念卡片",
    description: "适合概念、关键点和常见误区。",
  },
  {
    value: "procedure",
    label: "流程",
    description: "适合步骤和常见易错点。",
  },
  {
    value: "comparison_table",
    label: "对比表",
    description: "适合区分相似知识点或流程差异。",
  },
  {
    value: "math_formula",
    label: "数学公式",
    description: "适合 LaTeX 公式和变量说明。",
  },
  {
    value: "vocabulary",
    label: "词汇",
    description: "适合术语、定义和例句。",
  },
] as const;

export function KnowledgeItemAdminForm({
  initialValue = {},
  endpoint,
  deleteEndpoint,
  method,
  mode = "edit",
}: KnowledgeItemAdminFormProps) {
  const initialContentType =
    getString(initialValue, "contentType") || "plain_text";
  const [contentType, setContentType] = useState(initialContentType);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const renderPayload = getRecord(initialValue, "renderPayload");
  const isCreate = mode === "create";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const slug = field(formData, "slug");
    const payload = {
      slug,
      title: field(formData, "title"),
      domain: field(formData, "domain"),
      subdomain: field(formData, "subdomain"),
      difficulty: numberField(formData, "difficulty", 3),
      contentType,
      renderPayload: buildRenderPayload(contentType, formData),
      summary: field(formData, "summary"),
      body: field(formData, "body"),
      tags: lines(field(formData, "tags")),
      questions: parseQuestions(field(formData, "questions")),
      relations: parseRelations(field(formData, "relations"), slug),
    };

    startTransition(async () => {
      setError("");

      try {
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          setError(formatSaveError(responseBody));
          toast.error("保存失败，请检查表单内容。");
          return;
        }

        toast.success(isCreate ? "已创建知识项。" : "已保存");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "保存失败。";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start">
        <div className="grid gap-3">
          <FormSection
            title="基础信息"
            description="这部分决定知识项能否被搜索、分组和进入训练队列。"
          >
            <div className="grid items-start gap-3 lg:grid-cols-12">
              <Field
                name="slug"
                label="Slug"
                initialValue={initialValue}
                placeholder="例如：bayes-theorem"
                helperText="用于 URL 和关系引用，建议使用小写英文、数字和连字符。"
                wrapperClassName="lg:col-span-6"
                required
              />
              <Field
                name="title"
                label="标题"
                initialValue={initialValue}
                placeholder="例如：贝叶斯公式"
                wrapperClassName="lg:col-span-6"
                required
              />
              <Field
                name="domain"
                label="领域"
                initialValue={initialValue}
                placeholder="math"
                wrapperClassName="lg:col-span-3"
                required
              />
              <Field
                name="subdomain"
                label="子领域"
                initialValue={initialValue}
                placeholder="probability"
                wrapperClassName="lg:col-span-3"
              />
              <Field
                name="difficulty"
                label="难度"
                type="number"
                min={1}
                max={5}
                initialValue={initialValue}
                fallback="3"
                helperText="1 最容易，5 最难。"
                wrapperClassName="lg:col-span-2"
                required
              />
              <div className="grid gap-1.5 lg:col-span-4">
                <Label htmlFor="contentType" className="text-xs">
                  内容类型
                </Label>
                <Select
                  id="contentType"
                  name="contentType"
                  value={contentType}
                  onValueChange={(value) => {
                    if (value) setContentType(value);
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CONTENT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label} · {type.value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs leading-4 text-muted-foreground">
                  选择后下方会显示对应的内容字段。
                </p>
              </div>
            </div>

            <ContentTypeGuide contentType={contentType} />

            <TextareaField
              name="summary"
              label="摘要"
              initialValue={initialValue}
              className="min-h-20"
              placeholder="一句话说明这个知识项解决什么问题。"
              required
            />
            <TextareaField
              name="body"
              label="正文"
              initialValue={initialValue}
              className="min-h-32"
              placeholder="写清定义、背景、关键推理或使用方式。"
              required
            />
            <RenderPayloadFields
              contentType={contentType}
              renderPayload={renderPayload}
            />
          </FormSection>

          <FormSection
            title="训练资料"
            description="每行一条。用于题目和标签检索。"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ArrayTextarea
                name="tags"
                label="标签"
                value={initialValue}
                placeholder="probability&#10;conditional"
              />
            </div>
          </FormSection>

          <FormSection
            title="复习题"
            description="至少准备 1 道题。每行格式：type | prompt | answer | explanation | difficulty。"
          >
            <Label htmlFor="questions" className="text-xs">
              复习题明细
            </Label>
            <Textarea
              id="questions"
              name="questions"
              defaultValue={questionsText(initialValue.questions)}
              className="min-h-36 resize-y rounded-md bg-background font-mono text-sm leading-5"
              placeholder="recall | 贝叶斯公式解决什么问题？ | 用结果反推原因概率 | 注意和正向条件概率区分 | 3"
            />
          </FormSection>

          <div className="grid gap-3">
            <FormSection
              title="知识关系"
              description="可选。每行格式：toSlug | relationType | note。"
              advanced
              defaultOpen={!isCreate}
            >
              <Label htmlFor="relations" className="text-xs">
                知识关系明细
              </Label>
              <Textarea
                id="relations"
                name="relations"
                defaultValue={relationsText(initialValue.relations)}
                className="min-h-28 resize-y rounded-md bg-background font-mono text-sm leading-5"
                placeholder="total-probability | prerequisite | 需要先理解全概率公式"
              />
            </FormSection>
          </div>

          {error ? (
            <pre className="max-h-72 whitespace-pre-wrap overflow-auto rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
              {error}
            </pre>
          ) : null}
        </div>

        <aside className="grid gap-3 rounded-lg border bg-background p-3 shadow-sm xl:sticky xl:top-5">
          <div className="grid gap-2 border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {isCreate ? "创建路径" : "编辑路径"}
              </h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {isCreate ? "新建" : "编辑"}
              </span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              先保证知识项能被训练，再补高级结构。
            </p>
            <Button type="submit" size="sm" disabled={isPending} className="w-full">
              {isPending ? "保存中..." : isCreate ? "创建知识项" : "保存修改"}
            </Button>
          </div>
          <ol className="grid gap-1.5 text-xs">
            <li className="rounded-md border bg-muted/30 px-2.5 py-2">
              1. 基础信息和内容类型
            </li>
            <li className="rounded-md border bg-muted/30 px-2.5 py-2">
              2. 正文、条件和误用
            </li>
            <li className="rounded-md border bg-muted/30 px-2.5 py-2">
              3. 至少 1 道复习题
            </li>
            <li className="rounded-md border bg-muted/30 px-2.5 py-2">
              4. 按需补变量和关系
            </li>
          </ol>
          <p className="text-xs leading-5 text-muted-foreground">
            如果素材较长，优先使用 AI 导入生成草稿，再回来人工校正。
          </p>
          {!isCreate && deleteEndpoint ? (
            <div className="grid gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5">
              <div className="grid gap-1">
                <h3 className="text-xs font-semibold text-destructive">
                  删除知识项
                </h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  删除后相关复习题、变量、关系和学习记录也会一并移除。
                </p>
              </div>
              <KnowledgeItemDeleteButton
                endpoint={deleteEndpoint}
                title={getString(initialValue, "title") || "当前知识项"}
                redirectHref="/admin/knowledge-items"
                size="sm"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </form>
  );
}

function ContentTypeGuide({ contentType }: { contentType: string }) {
  const active = CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType);

  if (!active) {
    return null;
  }

  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm leading-5">
      <span className="font-medium">{active.label}</span>
      <span className="text-muted-foreground">：{active.description}</span>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
  advanced = false,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  advanced?: boolean;
  defaultOpen?: boolean;
}) {
  if (advanced) {
    return (
      <details
        open={defaultOpen}
        className="grid gap-3 rounded-lg border bg-background p-3 shadow-sm"
      >
        <summary className="cursor-pointer list-none marker:hidden">
          <span className="text-sm font-semibold">{title}</span>
          {description ? (
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {description}
            </span>
          ) : null}
        </summary>
        <div className="mt-3 grid gap-3">{children}</div>
      </details>
    );
  }

  return (
    <section className="grid gap-3 rounded-lg border bg-background p-3 shadow-sm">
      <div className="grid gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RenderPayloadFields({
  contentType,
  renderPayload,
}: {
  contentType: string;
  renderPayload: Record<string, unknown>;
}) {
  if (contentType === "math_formula") {
    return (
      <Field
        name="latex"
        label="LaTeX"
        initialValue={renderPayload}
        required
      />
    );
  }

  if (contentType === "vocabulary") {
    return (
      <div className="grid gap-3">
        <Field name="term" label="词条" initialValue={renderPayload} required />
        <Field
          name="definition"
          label="定义"
          initialValue={renderPayload}
          required
        />
        <TextareaField
          name="vocabularyExamples"
          label="例句"
          initialValue={{ vocabularyExamples: arrayText(renderPayload.examples) }}
          className="min-h-24"
        />
      </div>
    );
  }

  if (contentType === "concept_card") {
    return (
      <div className="grid gap-3">
        <TextareaField
          name="definition"
          label="概念定义"
          initialValue={renderPayload}
          required
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextareaField
            name="keyPoints"
            label="关键点"
            initialValue={{ keyPoints: arrayText(renderPayload.keyPoints) }}
            className="min-h-24"
          />
          <TextareaField
            name="misconceptions"
            label="常见误区"
            initialValue={{ misconceptions: arrayText(renderPayload.misconceptions) }}
            className="min-h-24"
          />
        </div>
      </div>
    );
  }

  if (contentType === "comparison_table") {
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <TextareaField
            name="matrixSubjects"
            label="对比对象"
            initialValue={{ matrixSubjects: arrayText(renderPayload.subjects) }}
            className="min-h-24"
            placeholder="贝叶斯定理&#10;全概率公式"
          />
          <TextareaField
            name="matrixAspects"
            label="对比维度"
            initialValue={{ matrixAspects: matrixAspectsText(renderPayload.aspects) }}
            className="min-h-24 font-mono text-sm"
            placeholder="用途 | 由结果反推原因 | 分情况求总概率"
          />
        </div>
      </div>
    );
  }

  if (contentType === "procedure") {
    return (
      <div className="grid gap-3">
        <TextareaField
          name="procedureSteps"
          label="流程步骤"
          initialValue={{ procedureSteps: procedureStepsText(renderPayload.steps) }}
          className="min-h-28 font-mono text-sm"
          placeholder="整理方程 | 合并同类项，把方程整理成 ax + b = c 的形式"
        />
        <TextareaField
          name="procedurePitfalls"
          label="易错点"
          initialValue={{ procedurePitfalls: arrayText(renderPayload.pitfalls) }}
          className="min-h-28 font-mono text-sm"
          placeholder="漏乘括号内每一项&#10;移项忘记变号"
        />
      </div>
    );
  }

  return (
    <TextareaField
      name="plainText"
      label="纯文本"
      initialValue={{ plainText: getString(renderPayload, "text") }}
      required
    />
  );
}

function formatSaveError(responseBody: unknown) {
  const record = isRecord(responseBody) ? responseBody : {};
  const errors = Array.isArray(record.errors) ? record.errors : [];

  if (errors.length > 0) {
    return errors
      .map((error, index) => {
        if (!isRecord(error)) {
          return `${index + 1}. 保存失败：${String(error)}`;
        }

        const path = getString(error, "path") || "表单";
        const message = getString(error, "message") || "请检查字段内容。";

        return `${index + 1}. ${path}：${message}`;
      })
      .join("\n");
  }

  const message = getString(record, "error");

  if (message) {
    return message;
  }

  return "保存失败，请检查字段内容。";
}

function Field({
  name,
  label,
  initialValue,
  fallback = "",
  helperText,
  wrapperClassName,
  className,
  ...props
}: {
  name: string;
  label: string;
  initialValue: Record<string, unknown>;
  fallback?: string;
  helperText?: string;
  wrapperClassName?: string;
} & ComponentProps<typeof Input>) {
  return (
    <div className={cn("grid gap-1.5", wrapperClassName)}>
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={getString(initialValue, name) || fallback}
        className={cn("h-9 rounded-md bg-background px-2.5 text-sm", className)}
        {...props}
      />
      {helperText ? (
        <p className="text-xs leading-4 text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

function TextareaField({
  name,
  label,
  initialValue,
  className,
  ...props
}: {
  name: string;
  label: string;
  initialValue: Record<string, unknown>;
  className?: string;
} & ComponentProps<typeof Textarea>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Textarea
        id={name}
        name={name}
        defaultValue={getString(initialValue, name)}
        className={cn(
          "min-h-24 resize-y rounded-md bg-background text-sm leading-5",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function ArrayTextarea({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value: Record<string, unknown>;
  placeholder?: string;
}) {
  return (
    <TextareaField
      name={name}
      label={label}
      initialValue={{ [name]: arrayText(value[name]) }}
      className="min-h-20"
      placeholder={placeholder}
    />
  );
}

function buildRenderPayload(contentType: string, formData: FormData) {
  if (contentType === "math_formula") {
    return { latex: field(formData, "latex") };
  }

  if (contentType === "vocabulary") {
    return {
      term: field(formData, "term"),
      definition: field(formData, "definition"),
      examples: lines(field(formData, "vocabularyExamples")),
    };
  }

  if (contentType === "concept_card") {
    return {
      definition: field(formData, "definition"),
      keyPoints: lines(field(formData, "keyPoints")),
      misconceptions: lines(field(formData, "misconceptions")),
    };
  }

  if (contentType === "comparison_table") {
    return {
      subjects: lines(field(formData, "matrixSubjects")),
      aspects: parseMatrixAspects(field(formData, "matrixAspects")),
    };
  }

  if (contentType === "procedure") {
    return {
      steps: parseProcedureSteps(field(formData, "procedureSteps")),
      pitfalls: lines(field(formData, "procedurePitfalls")),
    };
  }

  return { text: field(formData, "plainText") };
}

function parseMatrixAspects(value: string) {
  return lines(value).map((line) => {
    const [label = "", ...values] = splitLine(line);

    return {
      label,
      values,
    };
  });
}

function parseProcedureSteps(value: string) {
  return lines(value).map((line) => {
    const [title = "", detail = ""] = splitLine(line);

    return {
      title,
      detail,
    };
  });
}

function parseQuestions(value: string) {
  return lines(value).map((line) => {
    const [
      type = "",
      prompt = "",
      answer = "",
      explanation = "",
      difficulty = "3",
    ] = splitLine(line);

    return {
      type,
      prompt,
      answer,
      explanation,
      difficulty: parseInteger(difficulty, 3),
    };
  });
}

function parseRelations(value: string, fromSlug: string) {
  return lines(value).map((line) => {
    const [toSlug = "", relationType = "", note = ""] = splitLine(line);

    return {
      fromSlug,
      toSlug,
      relationType,
      note,
    };
  });
}

function questionsText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((question) =>
      [
        getString(question, "type"),
        getString(question, "prompt"),
        getString(question, "answer"),
        getString(question, "explanation"),
        getString(question, "difficulty"),
      ].join(" | "),
    )
    .join("\n");
}

function relationsText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((relation) =>
      [
        getString(relation, "toSlug"),
        getString(relation, "relationType"),
        getString(relation, "note"),
      ].join(" | "),
    )
    .join("\n");
}

function matrixAspectsText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((aspect) =>
      [
        getString(aspect, "label"),
        ...arrayStrings(aspect.values),
      ].join(" | "),
    )
    .join("\n");
}

function procedureStepsText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((step) =>
      [
        getString(step, "title"),
        getString(step, "detail"),
      ].join(" | "),
    )
    .join("\n");
}

function arrayText(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry)).join("\n")
    : "";
}

function arrayStrings(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLine(value: string) {
  return value.split("|").map((part) => part.trim());
}

function numberField(formData: FormData, name: string, fallback: number) {
  return parseInteger(field(formData, name), fallback);
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getRecord(value: Record<string, unknown>, key: string) {
  const nested = value[key];

  return isRecord(nested) ? nested : {};
}

function getString(value: Record<string, unknown>, key: string) {
  const entry = value[key];

  return typeof entry === "string" || typeof entry === "number"
    ? String(entry)
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

"use client";

import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { KnowledgeItemDeleteButton } from "@/components/admin/knowledge-item-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    description: "适合步骤、决策节点和 Mermaid 流程图。",
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
    description: "适合术语、定义、音标和词性。",
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
      intuition: field(formData, "intuition"),
      deepDive: field(formData, "deepDive"),
      useConditions: lines(field(formData, "useConditions")),
      nonUseConditions: lines(field(formData, "nonUseConditions")),
      antiPatterns: lines(field(formData, "antiPatterns")),
      typicalProblems: lines(field(formData, "typicalProblems")),
      examples: lines(field(formData, "examples")),
      tags: lines(field(formData, "tags")),
      variables: parseVariables(field(formData, "variables")),
      reviewItems: parseReviewItems(field(formData, "reviewItems")),
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
                <select
                  id="contentType"
                  name="contentType"
                  value={contentType}
                  onChange={(event) => setContentType(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {CONTENT_TYPE_OPTIONS.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} · {type.value}
                    </option>
                  ))}
                </select>
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
            <div className="grid gap-3 md:grid-cols-2">
              <TextareaField
                name="intuition"
                label="直觉解释"
                initialValue={initialValue}
                placeholder="用更口语的方式解释它为什么成立。"
              />
              <TextareaField
                name="deepDive"
                label="深入说明"
                initialValue={initialValue}
                placeholder="可选：补充推导、边界或更深入的解释。"
              />
            </div>

            <RenderPayloadFields
              contentType={contentType}
              renderPayload={renderPayload}
            />
          </FormSection>

          <FormSection
            title="训练语境"
            description="每行一条。这里会直接影响学习者在详情页和补弱时看到的结构。"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ArrayTextarea
                name="useConditions"
                label="使用条件"
                value={initialValue}
                placeholder="题目要求反推条件概率&#10;已知 P(B|A)、P(A)、P(B)"
              />
              <ArrayTextarea
                name="nonUseConditions"
                label="不使用条件"
                value={initialValue}
                placeholder="只需要正向条件概率&#10;缺少总体概率信息"
              />
              <ArrayTextarea
                name="antiPatterns"
                label="反模式"
                value={initialValue}
                placeholder="把 P(A|B) 和 P(B|A) 混用"
              />
              <ArrayTextarea
                name="typicalProblems"
                label="典型问题"
                value={initialValue}
                placeholder="医学检测阳性后的真实患病概率"
              />
              <ArrayTextarea
                name="examples"
                label="示例"
                value={initialValue}
                placeholder="如果检测准确率为..."
              />
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
            <Label htmlFor="reviewItems" className="text-xs">
              复习题明细
            </Label>
            <Textarea
              id="reviewItems"
              name="reviewItems"
              defaultValue={reviewItemsText(initialValue.reviewItems)}
              className="min-h-36 resize-y rounded-md bg-background font-mono text-sm leading-5"
              placeholder="recall | 贝叶斯公式解决什么问题？ | 用结果反推原因概率 | 注意和正向条件概率区分 | 3"
            />
          </FormSection>

          <div className="grid gap-3 lg:grid-cols-2">
            <FormSection
              title="变量"
              description="公式或流程需要变量时再填。每行格式：symbol | name | description | unit。"
              advanced
              defaultOpen={!isCreate}
            >
              <Label htmlFor="variables" className="text-xs">
                变量明细
              </Label>
              <Textarea
                id="variables"
                name="variables"
                defaultValue={variablesText(initialValue.variables)}
                className="min-h-28 resize-y rounded-md bg-background font-mono text-sm leading-5"
                placeholder="P(A|B) | 后验概率 | 已知 B 发生后 A 发生的概率 |"
              />
            </FormSection>

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
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="term" label="词条" initialValue={renderPayload} required />
        <Field
          name="definition"
          label="定义"
          initialValue={renderPayload}
          required
        />
        <Field name="phonetic" label="音标" initialValue={renderPayload} />
        <Field name="partOfSpeech" label="词性" initialValue={renderPayload} />
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
        <TextareaField
          name="conceptIntuition"
          label="概念直觉"
          initialValue={{ conceptIntuition: getString(renderPayload, "intuition") }}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <TextareaField
            name="keyPoints"
            label="关键点"
            initialValue={{ keyPoints: arrayText(renderPayload.keyPoints) }}
            className="min-h-24"
          />
          <TextareaField
            name="conceptExamples"
            label="概念示例"
            initialValue={{ conceptExamples: arrayText(renderPayload.examples) }}
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
    const comparisonMode = getString(renderPayload, "mode") || "matrix";

    return (
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="comparisonMode" className="text-xs">
            对比表模式
          </Label>
          <select
            id="comparisonMode"
            name="comparisonMode"
            defaultValue={comparisonMode}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="matrix">matrix</option>
            <option value="table">table</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TextareaField
            name="matrixSubjects"
            label="Matrix subjects"
            initialValue={{ matrixSubjects: arrayText(renderPayload.subjects) }}
            className="min-h-24"
            placeholder="Bayes&#10;Total probability"
          />
          <TextareaField
            name="matrixAspects"
            label="Matrix aspects"
            initialValue={{ matrixAspects: matrixAspectsText(renderPayload.aspects) }}
            className="min-h-24 font-mono text-sm"
            placeholder="Use | Reverse conditional | Marginalize cases"
          />
          <TextareaField
            name="tableColumns"
            label="Table columns"
            initialValue={{ tableColumns: arrayText(renderPayload.columns) }}
            className="min-h-24"
            placeholder="Step&#10;Action"
          />
          <TextareaField
            name="tableRows"
            label="Table rows"
            initialValue={{ tableRows: tableRowsText(renderPayload.rows) }}
            className="min-h-24 font-mono text-sm"
            placeholder="1 | Read source&#10;2 | Extract concepts"
          />
        </div>
      </div>
    );
  }

  if (contentType === "procedure") {
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            name="procedureTitle"
            label="流程标题"
            initialValue={{ procedureTitle: getString(renderPayload, "title") }}
            required
          />
          <TextareaField
            name="procedureOverview"
            label="流程概览"
            initialValue={{ procedureOverview: getString(renderPayload, "overview") }}
          />
        </div>
        <TextareaField
          name="procedureSteps"
          label="流程步骤"
          initialValue={{ procedureSteps: procedureStepsText(renderPayload.steps) }}
          className="min-h-28 font-mono text-sm"
          placeholder="id | title | description | tip 1, tip 2 | pitfall 1"
        />
        <TextareaField
          name="procedureNodes"
          label="流程节点"
          initialValue={{ procedureNodes: procedureNodesText(renderPayload.nodes) }}
          className="min-h-28 font-mono text-sm"
          placeholder="id | label | start|step|decision|end"
        />
        <TextareaField
          name="procedureEdges"
          label="流程边"
          initialValue={{ procedureEdges: procedureEdgesText(renderPayload.edges) }}
          className="min-h-28 font-mono text-sm"
          placeholder="from | to | label"
        />
        <TextareaField
          name="mermaid"
          label="Mermaid"
          initialValue={renderPayload}
          className="min-h-32 font-mono text-sm"
          required
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
      phonetic: field(formData, "phonetic"),
      partOfSpeech: field(formData, "partOfSpeech"),
    };
  }

  if (contentType === "concept_card") {
    return {
      definition: field(formData, "definition"),
      intuition: field(formData, "conceptIntuition"),
      keyPoints: lines(field(formData, "keyPoints")),
      examples: lines(field(formData, "conceptExamples")),
      misconceptions: lines(field(formData, "misconceptions")),
    };
  }

  if (contentType === "comparison_table") {
    const mode = field(formData, "comparisonMode") || "matrix";

    if (mode === "table") {
      return {
        mode,
        columns: lines(field(formData, "tableColumns")),
        rows: parsePipeRows(field(formData, "tableRows")),
      };
    }

    return {
      mode: "matrix",
      subjects: lines(field(formData, "matrixSubjects")),
      aspects: parseMatrixAspects(field(formData, "matrixAspects")),
    };
  }

  if (contentType === "procedure") {
    return {
      mode: "flowchart",
      title: field(formData, "procedureTitle"),
      overview: field(formData, "procedureOverview"),
      steps: parseProcedureSteps(field(formData, "procedureSteps")),
      nodes: parseProcedureNodes(field(formData, "procedureNodes")),
      edges: parseProcedureEdges(field(formData, "procedureEdges")),
      mermaid: field(formData, "mermaid"),
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

function parsePipeRows(value: string) {
  return lines(value).map(splitLine);
}

function parseProcedureSteps(value: string) {
  return lines(value).map((line) => {
    const [
      id = "",
      title = "",
      description = "",
      tips = "",
      pitfalls = "",
    ] = splitLine(line);

    return {
      id,
      title,
      description,
      tips: splitCellList(tips),
      pitfalls: splitCellList(pitfalls),
    };
  });
}

function parseProcedureNodes(value: string) {
  return lines(value).map((line) => {
    const [id = "", label = "", kind = "step"] = splitLine(line);

    return {
      id,
      label,
      kind,
    };
  });
}

function parseProcedureEdges(value: string) {
  return lines(value).map((line) => {
    const [from = "", to = "", label = ""] = splitLine(line);

    return {
      from,
      to,
      label,
    };
  });
}

function parseVariables(value: string) {
  return lines(value).map((line, index) => {
    const [symbol = "", name = "", description = "", unit = ""] = splitLine(line);

    return {
      symbol,
      name,
      description,
      unit,
      sortOrder: index,
    };
  });
}

function parseReviewItems(value: string) {
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

function variablesText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((variable) =>
      [
        getString(variable, "symbol"),
        getString(variable, "name"),
        getString(variable, "description"),
        getString(variable, "unit"),
      ].join(" | "),
    )
    .join("\n");
}

function reviewItemsText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((reviewItem) =>
      [
        getString(reviewItem, "type"),
        getString(reviewItem, "prompt"),
        getString(reviewItem, "answer"),
        getString(reviewItem, "explanation"),
        getString(reviewItem, "difficulty"),
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

function tableRowsText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map(String).join(" | "))
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
        getString(step, "id"),
        getString(step, "title"),
        getString(step, "description"),
        arrayStrings(step.tips).join(", "),
        arrayStrings(step.pitfalls).join(", "),
      ].join(" | "),
    )
    .join("\n");
}

function procedureNodesText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((node) =>
      [
        getString(node, "id"),
        getString(node, "label"),
        getString(node, "kind"),
      ].join(" | "),
    )
    .join("\n");
}

function procedureEdgesText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((edge) =>
      [
        getString(edge, "from"),
        getString(edge, "to"),
        getString(edge, "label"),
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

function splitCellList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

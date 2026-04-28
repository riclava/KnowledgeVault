"use client";

import type { ComponentProps, FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type KnowledgeItemAdminFormProps = {
  initialValue?: Record<string, unknown>;
  endpoint: string;
  method: "POST" | "PUT";
};

const CONTENT_TYPES = [
  "math_formula",
  "vocabulary",
  "plain_text",
  "concept_card",
  "comparison_table",
  "procedure",
] as const;

export function KnowledgeItemAdminForm({
  initialValue = {},
  endpoint,
  method,
}: KnowledgeItemAdminFormProps) {
  const initialContentType =
    getString(initialValue, "contentType") || "plain_text";
  const [contentType, setContentType] = useState(initialContentType);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const renderPayload = getRecord(initialValue, "renderPayload");

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
      setSuccess("");

      try {
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          setError(JSON.stringify(responseBody, null, 2));
          return;
        }

        setSuccess("已保存");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "保存失败。");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <section className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm">
        <h2 className="text-lg font-semibold">基础信息</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="slug" label="Slug" initialValue={initialValue} required />
          <Field
            name="title"
            label="标题"
            initialValue={initialValue}
            required
          />
          <Field
            name="domain"
            label="领域"
            initialValue={initialValue}
            required
          />
          <Field name="subdomain" label="子领域" initialValue={initialValue} />
          <Field
            name="difficulty"
            label="难度"
            type="number"
            min={1}
            max={5}
            initialValue={initialValue}
            fallback="3"
            required
          />
          <div className="grid gap-2">
            <Label htmlFor="contentType">内容类型</Label>
            <select
              id="contentType"
              name="contentType"
              value={contentType}
              onChange={(event) => setContentType(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {CONTENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <RenderPayloadFields
          contentType={contentType}
          renderPayload={renderPayload}
        />

        <TextareaField
          name="summary"
          label="摘要"
          initialValue={initialValue}
          required
        />
        <TextareaField
          name="body"
          label="正文"
          initialValue={initialValue}
          className="min-h-40"
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextareaField
            name="intuition"
            label="直觉解释"
            initialValue={initialValue}
          />
          <TextareaField
            name="deepDive"
            label="深入说明"
            initialValue={initialValue}
          />
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm">
        <h2 className="text-lg font-semibold">数组字段</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ArrayTextarea name="useConditions" label="使用条件" value={initialValue} />
          <ArrayTextarea
            name="nonUseConditions"
            label="不使用条件"
            value={initialValue}
          />
          <ArrayTextarea name="antiPatterns" label="反模式" value={initialValue} />
          <ArrayTextarea
            name="typicalProblems"
            label="典型问题"
            value={initialValue}
          />
          <ArrayTextarea name="examples" label="示例" value={initialValue} />
          <ArrayTextarea name="tags" label="标签" value={initialValue} />
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm">
        <h2 className="text-lg font-semibold">变量</h2>
        <Label htmlFor="variables">变量明细</Label>
        <Textarea
          id="variables"
          name="variables"
          defaultValue={variablesText(initialValue.variables)}
          className="min-h-32 font-mono text-sm"
          placeholder="symbol | name | description | unit"
        />
      </section>

      <section className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm">
        <h2 className="text-lg font-semibold">复习题</h2>
        <Label htmlFor="reviewItems">复习题明细</Label>
        <Textarea
          id="reviewItems"
          name="reviewItems"
          defaultValue={reviewItemsText(initialValue.reviewItems)}
          className="min-h-40 font-mono text-sm"
          placeholder="type | prompt | answer | explanation | difficulty"
        />
      </section>

      <section className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm">
        <h2 className="text-lg font-semibold">知识关系</h2>
        <Label htmlFor="relations">知识关系明细</Label>
        <Textarea
          id="relations"
          name="relations"
          defaultValue={relationsText(initialValue.relations)}
          className="min-h-32 font-mono text-sm"
          placeholder="toSlug | relationType | note"
        />
      </section>

      {error ? (
        <pre className="max-h-72 overflow-auto rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </pre>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </form>
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
      <div className="grid gap-4 md:grid-cols-2">
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
      <div className="grid gap-4">
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
        <div className="grid gap-4 md:grid-cols-3">
          <TextareaField
            name="keyPoints"
            label="关键点"
            initialValue={{ keyPoints: arrayText(renderPayload.keyPoints) }}
            className="min-h-28"
          />
          <TextareaField
            name="conceptExamples"
            label="概念示例"
            initialValue={{ conceptExamples: arrayText(renderPayload.examples) }}
            className="min-h-28"
          />
          <TextareaField
            name="misconceptions"
            label="常见误区"
            initialValue={{ misconceptions: arrayText(renderPayload.misconceptions) }}
            className="min-h-28"
          />
        </div>
      </div>
    );
  }

  if (contentType === "comparison_table") {
    const comparisonMode = getString(renderPayload, "mode") || "matrix";

    return (
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="comparisonMode">对比表模式</Label>
          <select
            id="comparisonMode"
            name="comparisonMode"
            defaultValue={comparisonMode}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="matrix">matrix</option>
            <option value="table">table</option>
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextareaField
            name="matrixSubjects"
            label="Matrix subjects"
            initialValue={{ matrixSubjects: arrayText(renderPayload.subjects) }}
            className="min-h-28"
            placeholder="Bayes&#10;Total probability"
          />
          <TextareaField
            name="matrixAspects"
            label="Matrix aspects"
            initialValue={{ matrixAspects: matrixAspectsText(renderPayload.aspects) }}
            className="min-h-28 font-mono text-sm"
            placeholder="Use | Reverse conditional | Marginalize cases"
          />
          <TextareaField
            name="tableColumns"
            label="Table columns"
            initialValue={{ tableColumns: arrayText(renderPayload.columns) }}
            className="min-h-28"
            placeholder="Step&#10;Action"
          />
          <TextareaField
            name="tableRows"
            label="Table rows"
            initialValue={{ tableRows: tableRowsText(renderPayload.rows) }}
            className="min-h-28 font-mono text-sm"
            placeholder="1 | Read source&#10;2 | Extract concepts"
          />
        </div>
      </div>
    );
  }

  if (contentType === "procedure") {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
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
          className="min-h-32 font-mono text-sm"
          placeholder="id | title | description | tip 1, tip 2 | pitfall 1"
        />
        <TextareaField
          name="procedureNodes"
          label="流程节点"
          initialValue={{ procedureNodes: procedureNodesText(renderPayload.nodes) }}
          className="min-h-32 font-mono text-sm"
          placeholder="id | label | start|step|decision|end"
        />
        <TextareaField
          name="procedureEdges"
          label="流程边"
          initialValue={{ procedureEdges: procedureEdgesText(renderPayload.edges) }}
          className="min-h-32 font-mono text-sm"
          placeholder="from | to | label"
        />
        <TextareaField
          name="mermaid"
          label="Mermaid"
          initialValue={renderPayload}
          className="min-h-40 font-mono text-sm"
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

function Field({
  name,
  label,
  initialValue,
  fallback = "",
  ...props
}: {
  name: string;
  label: string;
  initialValue: Record<string, unknown>;
  fallback?: string;
} & ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={getString(initialValue, name) || fallback}
        {...props}
      />
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
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        name={name}
        defaultValue={getString(initialValue, name)}
        className={className}
        {...props}
      />
    </div>
  );
}

function ArrayTextarea({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: Record<string, unknown>;
}) {
  return (
    <TextareaField
      name={name}
      label={label}
      initialValue={{ [name]: arrayText(value[name]) }}
      className="min-h-28"
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

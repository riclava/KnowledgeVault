import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

export const KNOWLEDGE_ITEM_TYPES = [
  "math_formula",
  "vocabulary",
  "plain_text",
  "concept_card",
  "comparison_table",
  "procedure",
] as const satisfies KnowledgeItemType[];

export function parseKnowledgeItemType(value: unknown): KnowledgeItemType | null {
  return typeof value === "string" &&
    KNOWLEDGE_ITEM_TYPES.includes(value as KnowledgeItemType)
    ? (value as KnowledgeItemType)
    : null;
}

export function normalizeKnowledgeItemRenderPayload<TType extends KnowledgeItemType>(
  contentType: TType,
  payload: unknown,
): KnowledgeItemRenderPayloadByType[TType] {
  if (!payload || typeof payload !== "object") {
    throw new Error("renderPayload must be an object");
  }

  const record = payload as Record<string, unknown>;

  if (contentType === "math_formula") {
    const latex = toText(record.latex);

    if (!latex) {
      throw new Error("math formula payload requires latex");
    }

    return { latex } as KnowledgeItemRenderPayloadByType[TType];
  }

  if (contentType === "vocabulary") {
    const term = toText(record.term);
    const definition = toText(record.definition);

    if (!term) {
      throw new Error("vocabulary payload requires term");
    }

    if (!definition) {
      throw new Error("vocabulary payload requires definition");
    }

    return {
      term,
      definition,
      phonetic: toText(record.phonetic),
      partOfSpeech: toText(record.partOfSpeech),
      examples: toTextList(record.examples),
    } as KnowledgeItemRenderPayloadByType[TType];
  }

  if (contentType === "concept_card") {
    const definition = toText(record.definition);

    if (!definition) {
      throw new Error("concept card payload requires definition");
    }

    return {
      definition,
      intuition: toText(record.intuition),
      keyPoints: toTextList(record.keyPoints),
      examples: toTextList(record.examples),
      misconceptions: toTextList(record.misconceptions),
    } as KnowledgeItemRenderPayloadByType[TType];
  }

  if (contentType === "comparison_table") {
    return normalizeComparisonTablePayload(record) as KnowledgeItemRenderPayloadByType[TType];
  }

  if (contentType === "procedure") {
    return normalizeProcedurePayload(record) as KnowledgeItemRenderPayloadByType[TType];
  }

  const text = toText(record.text);

  if (!text) {
    throw new Error("plain text payload requires text");
  }

  return { text } as KnowledgeItemRenderPayloadByType[TType];
}

export function buildTypedKnowledgeItemRenderPayload<TType extends KnowledgeItemType>(
  contentType: TType,
  payload: KnowledgeItemRenderPayloadByType[TType],
) {
  return {
    type: contentType,
    ...payload,
  };
}

export function knowledgeItemRenderPayloadToText(
  contentType: KnowledgeItemType,
  payload: KnowledgeItemRenderPayloadByType[KnowledgeItemType],
) {
  if (contentType === "vocabulary" && "definition" in payload) {
    return payload.definition;
  }

  if (contentType === "plain_text" && "text" in payload) {
    return payload.text;
  }

  if (contentType === "concept_card" && "intuition" in payload) {
    return [
      payload.definition,
      payload.intuition,
      ...payload.keyPoints,
      ...payload.examples,
      ...payload.misconceptions,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (contentType === "comparison_table" && "mode" in payload) {
    if (payload.mode === "matrix") {
      return [
        ...payload.subjects,
        ...payload.aspects.flatMap((aspect) => [aspect.label, ...aspect.values]),
      ]
        .filter(Boolean)
        .join("\n");
    }

    if ("columns" in payload) {
      return [payload.columns, ...payload.rows]
        .flat()
        .filter(Boolean)
        .join("\n");
    }
  }

  if (contentType === "procedure" && "steps" in payload) {
    return [
      payload.title,
      payload.overview,
      ...payload.steps.flatMap((step) => [
        step.title,
        step.description,
        ...step.tips,
        ...step.pitfalls,
      ]),
      ...payload.nodes.map((node) => node.label),
      ...payload.edges.map((edge) => edge.label ?? ""),
      payload.mermaid,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if ("latex" in payload) {
    return payload.latex;
  }

  return "";
}

function toText(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function toTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean);
  }

  return toText(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeComparisonTablePayload(record: Record<string, unknown>) {
  const mode = toText(record.mode);

  if (mode === "matrix") {
    const subjects = toTextList(record.subjects);

    if (subjects.length < 2) {
      throw new Error("comparison table matrix requires at least two subjects");
    }

    const aspects = toRecordList(record.aspects).map((aspect) => {
      const label = toText(aspect.label);

      if (!label) {
        throw new Error("comparison table matrix aspect requires label");
      }

      return {
        label,
        values: normalizeCells(toTextList(aspect.values), subjects.length),
      };
    });

    if (aspects.length === 0) {
      throw new Error("comparison table matrix requires at least one aspect");
    }

    return {
      mode,
      subjects,
      aspects,
    };
  }

  if (mode === "table") {
    const columns = toTextList(record.columns);

    if (columns.length === 0) {
      throw new Error("comparison table requires at least one column");
    }

    const rows = toRowList(record.rows).map((row) =>
      normalizeCells(row.map(toText), columns.length),
    );

    if (rows.length === 0) {
      throw new Error("comparison table requires at least one row");
    }

    return {
      mode,
      columns,
      rows,
    };
  }

  throw new Error("comparison table payload requires matrix or table mode");
}

function normalizeProcedurePayload(record: Record<string, unknown>) {
  const mode = toText(record.mode);

  if (mode !== "flowchart") {
    throw new Error("procedure payload requires flowchart mode");
  }

  const title = toText(record.title);
  const mermaid = toText(record.mermaid);

  if (!title) {
    throw new Error("procedure payload requires title");
  }

  if (!mermaid) {
    throw new Error("procedure payload requires mermaid");
  }

  const steps = toRecordList(record.steps).map((step) => {
    const id = toText(step.id);
    const stepTitle = toText(step.title);
    const description = toText(step.description);

    if (!id || !stepTitle || !description) {
      throw new Error("procedure step requires id, title, and description");
    }

    return {
      id,
      title: stepTitle,
      description,
      tips: toTextList(step.tips),
      pitfalls: toTextList(step.pitfalls),
    };
  });

  if (steps.length === 0) {
    throw new Error("procedure payload requires at least one step");
  }

  const nodes = toRecordList(record.nodes).map((node) => {
    const id = toText(node.id);
    const label = toText(node.label);
    const kind = toText(node.kind);

    if (!id || !label) {
      throw new Error("procedure node requires id and label");
    }

    if (!isProcedureNodeKind(kind)) {
      throw new Error("procedure node kind must be start, step, decision, or end");
    }

    return {
      id,
      label,
      kind,
    };
  });

  if (nodes.length < 2) {
    throw new Error("procedure payload requires at least two nodes");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = toRecordList(record.edges).map((edge) => {
    const from = toText(edge.from);
    const to = toText(edge.to);

    if (!from || !to) {
      throw new Error("procedure edge requires from and to");
    }

    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      throw new Error("unknown procedure node referenced by edge");
    }

    return {
      from,
      to,
      label: toText(edge.label) || null,
    };
  });

  return {
    mode,
    title,
    overview: toText(record.overview),
    steps,
    nodes,
    edges,
    mermaid,
  };
}

function normalizeCells(values: string[], length: number) {
  return Array.from({ length }, (_, index) => values[index] ?? "");
}

function toRecordList(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function toRowList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((row): row is unknown[] => Array.isArray(row));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProcedureNodeKind(
  value: string,
): value is "start" | "step" | "decision" | "end" {
  return value === "start" || value === "step" || value === "decision" || value === "end";
}

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

    return {
      latex,
      explanation: toText(record.explanation),
      variables: toRecordList(record.variables).flatMap((variable) => {
        const symbol = toText(variable.symbol);
        const name = toText(variable.name);

        if (!symbol || !name) {
          return [];
        }

        return {
          symbol,
          name,
          meaning: toText(variable.meaning ?? variable.description),
        };
      }),
    } as KnowledgeItemRenderPayloadByType[TType];
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
      keyPoints: toTextList(record.keyPoints),
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

  if (contentType === "concept_card" && "keyPoints" in payload) {
    return [payload.definition, ...payload.keyPoints, ...payload.misconceptions]
      .filter(Boolean)
      .join("\n");
  }

  if (contentType === "comparison_table" && "subjects" in payload) {
    return [
      ...payload.subjects,
      ...payload.aspects.flatMap((aspect) => [aspect.label, ...aspect.values]),
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (contentType === "procedure" && "steps" in payload) {
    return [
      ...payload.steps.flatMap((step) => [step.title, step.detail]),
      ...payload.pitfalls,
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
  const subjects = toTextList(record.subjects);

  if (subjects.length < 2) {
    throw new Error("comparison table requires at least two subjects");
  }

  const aspects = toRecordList(record.aspects).map((aspect) => {
    const label = toText(aspect.label);

    if (!label) {
      throw new Error("comparison table aspect requires label");
    }

    return {
      label,
      values: normalizeCells(toTextList(aspect.values), subjects.length),
    };
  });

  if (aspects.length === 0) {
    throw new Error("comparison table requires at least one aspect");
  }

  return {
    subjects,
    aspects,
  };
}

function normalizeProcedurePayload(record: Record<string, unknown>) {
  const steps = toRecordList(record.steps).map((step) => {
    const stepTitle = toText(step.title);

    if (!stepTitle) {
      throw new Error("procedure step requires title");
    }

    return {
      title: stepTitle,
      detail: toText(step.detail ?? step.description),
    };
  });

  if (steps.length === 0) {
    throw new Error("procedure payload requires at least one steps entry");
  }

  return {
    steps,
    pitfalls: toTextList(record.pitfalls),
  };
}

function normalizeCells(values: string[], length: number) {
  return Array.from({ length }, (_, index) => values[index] ?? "");
}

function toRecordList(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

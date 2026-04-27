import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

export const KNOWLEDGE_ITEM_TYPES = [
  "math_formula",
  "vocabulary",
  "plain_text",
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

import {
  normalizeKnowledgeItemRenderPayload,
  parseKnowledgeItemType,
} from "@/lib/knowledge-item-render-payload";
import { createChatCompletion } from "@/server/services/openai-compatible-client";
import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

export type GeneratedKnowledgeItemDraft = {
  title: string;
  contentType: KnowledgeItemType;
  renderPayload: KnowledgeItemRenderPayloadByType[KnowledgeItemType];
  domain: string;
  subdomain: string;
  summary: string;
  body: string;
  deepDive: string;
  difficulty: number;
  tags: string[];
  useConditions: string[];
  nonUseConditions: string[];
  antiPatterns: string[];
  typicalProblems: string[];
  examples: string[];
  memoryHook: string;
};

export async function generateKnowledgeItemDraft({
  prompt,
}: {
  prompt: string;
}): Promise<GeneratedKnowledgeItemDraft> {
  const content = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: [
          "你是 KnowledgeVault 的通用知识项整理助手。",
          "请把用户给出的公式、单词、纯文本、题目、笔记或学习目标整理成严格 JSON。",
          "面向中文学习者，内容要短、准、可直接进入间隔复习。",
          "数学公式使用 math_formula，LaTeX 只写表达式本体，不要包裹 $ 或 $$。",
          "单词使用 vocabulary，纯文本知识使用 plain_text。",
          "如果信息不足，请做保守补全，并避免编造复杂背景。",
        ].join("\n"),
      },
      {
        role: "user",
        content: buildKnowledgeItemDraftPrompt(prompt),
      },
    ],
    responseFormat: { type: "json_object" },
    maxCompletionTokens: 1400,
  });

  return normalizeGeneratedKnowledgeItemDraft(parseJsonContent(content));
}

function buildKnowledgeItemDraftPrompt(prompt: string) {
  return [
    "请根据下面输入生成一个知识项草稿。",
    "",
    "必须返回 JSON object，字段如下：",
    "{",
    '  "title": "知识项标题",',
    '  "contentType": "math_formula | vocabulary | plain_text",',
    '  "renderPayload": {',
    '    "latex": "数学公式 LaTeX，仅 math_formula 使用",',
    '    "term": "单词，仅 vocabulary 使用",',
    '    "phonetic": "音标，可为空",',
    '    "partOfSpeech": "词性，可为空",',
    '    "definition": "释义，仅 vocabulary 使用",',
    '    "examples": ["例句，仅 vocabulary 使用"],',
    '    "text": "文本内容，仅 plain_text 使用"',
    "  },",
    '  "domain": "知识域",',
    '  "subdomain": "子领域",',
    '  "summary": "一句话用途",',
    '  "body": "知识项说明",',
    '  "deepDive": "深入理解要点、结构拆解或关键推导，可为空字符串",',
    '  "difficulty": 1到5的整数,',
    '  "tags": ["标签"],',
    '  "useConditions": ["什么时候用"],',
    '  "nonUseConditions": ["什么时候不能用"],',
    '  "antiPatterns": ["常见误用"],',
    '  "typicalProblems": ["典型场景"],',
    '  "examples": ["例题或应用场景"],',
    '  "memoryHook": "一句下次提示"',
    "}",
    "",
    "用户输入：",
    prompt,
  ].join("\n");
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fencedJson?.[1] ?? trimmed;
  return JSON.parse(jsonText) as unknown;
}

function normalizeGeneratedKnowledgeItemDraft(value: unknown): GeneratedKnowledgeItemDraft {
  if (!value || typeof value !== "object") {
    throw new Error("AI returned an invalid knowledgeItem draft");
  }

  const record = value as Record<string, unknown>;
  const title = toText(record.title);
  const summary = toText(record.summary);
  const contentType = parseKnowledgeItemType(record.contentType) ?? "plain_text";
  const renderPayload = normalizeKnowledgeItemRenderPayload(
    contentType,
    typeof record.renderPayload === "object" && record.renderPayload
      ? record.renderPayload
      : legacyPayloadForType(contentType, record.renderPayload),
  );

  if (!title || !summary) {
    throw new Error("AI draft is missing title, renderPayload or summary");
  }

  return {
    title,
    contentType,
    renderPayload,
    domain: toText(record.domain) || "自定义知识项",
    subdomain: toText(record.subdomain),
    summary,
    body: toText(record.body) || summary,
    deepDive: toText(record.deepDive),
    difficulty: clampInteger(Number(record.difficulty ?? 2), 1, 5),
    tags: toTextList(record.tags, ["custom"]),
    useConditions: toTextList(record.useConditions, [
      "能从题目、语境或笔记中判断这条知识项正好适用。",
    ]),
    nonUseConditions: toTextList(record.nonUseConditions, [
      "适用语境或前提条件无法确认时，不要直接套用。",
    ]),
    antiPatterns: toTextList(record.antiPatterns, [
      "只记结论但没有确认适用条件。",
    ]),
    typicalProblems: toTextList(record.typicalProblems, [
      `${title} 的基础识别和代入题。`,
    ]),
    examples: toTextList(record.examples, [
      `看到题目要求“${summary}”时，先判断是否可以使用 ${title}。`,
    ]),
    memoryHook: toText(record.memoryHook),
  };
}

function legacyPayloadForType(contentType: KnowledgeItemType, value: unknown) {
  const text = toText(value);

  if (contentType === "math_formula") {
    return { latex: text };
  }

  if (contentType === "vocabulary") {
    return {
      term: text,
      definition: text,
    };
  }

  return { text };
}

function toText(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function toTextList(value: unknown, fallback: string[]) {
  const list = Array.isArray(value)
    ? value.map(toText)
    : toText(value).split(/[\n,]/);
  const normalized = list.map((item) => item.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

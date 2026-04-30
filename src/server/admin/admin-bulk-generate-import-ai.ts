import type { KnowledgeItemType } from "@/generated/prisma/client";
import { createAdminImportJsonSchema } from "@/server/admin/admin-import-ai";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";
import { chatJson } from "@/server/ai/openai-compatible";

export type AdminBulkGenerateImportGenerateInput = {
  sourceText: string;
  contentType: KnowledgeItemType;
  domain: string;
  subdomain?: string;
};

export async function generateAdminBulkGenerateImportItemBatch(
  input: AdminBulkGenerateImportGenerateInput,
): Promise<AdminImportBatch> {
  const provider = normalizeAdminImportProvider(process.env.ADMIN_IMPORT_PROVIDER);
  const globalAiProvider = normalizeAdminImportProvider(process.env.AI_PROVIDER);

  if (provider === "mock") {
    return generateMockAdminBulkGenerateImportItemBatch(input);
  }

  if (provider === "ai" || provider === "openai-compatible") {
    return generateCompatibleAdminBulkGenerateImportItemBatch(input);
  }

  if (isDirectAiProvider(provider)) {
    return generateCompatibleAdminBulkGenerateImportItemBatch(input, provider);
  }

  if (!provider && isDirectAiProvider(globalAiProvider)) {
    return generateCompatibleAdminBulkGenerateImportItemBatch(input);
  }

  if (!provider) {
    return generateMockAdminBulkGenerateImportItemBatch(input);
  }

  throw new Error(`Unsupported ADMIN_IMPORT_PROVIDER: ${provider}`);
}

export async function generateMockAdminBulkGenerateImportItemBatch(
  input: AdminBulkGenerateImportGenerateInput,
): Promise<AdminImportBatch> {
  const sourceText = input.sourceText.trim();
  const slug = `bulk-${slugToken(sourceText)}`;

  return {
    sourceTitle: sourceText,
    defaultDomain: input.domain,
    items: [
      {
        slug,
        title: `${sourceText}知识卡`,
        contentType: input.contentType,
        renderPayload: buildMockRenderPayload(input.contentType, sourceText),
        domain: input.domain,
        subdomain: input.subdomain,
        summary: `${sourceText}的核心知识点。`,
        body: `${sourceText}是本批量导入根据标题生成的知识项。`,
        intuition: `先抓住${sourceText}的定义、适用条件和常见误区。`,
        deepDive: `${sourceText}需要结合例子、边界条件和复习题形成可回忆的结构。`,
        useConditions: [`需要理解${sourceText}时使用`],
        nonUseConditions: [`材料并不涉及${sourceText}时不使用`],
        antiPatterns: [`只记住${sourceText}名称而不理解含义`],
        typicalProblems: [`解释${sourceText}的关键点`],
        examples: [`用一句话说明${sourceText}`],
        tags: [sourceText, input.domain],
        difficulty: 2,
        variables: [],
        reviewItems: [
          {
            type: "fill_blank",
            prompt: `${sourceText}是什么？`,
            answer: `${sourceText}是需要掌握的核心知识点。`,
            explanation: "批量生成导入会围绕标题补全定义、例子和复习题。",
            difficulty: 2,
          },
        ],
      },
    ],
    relations: [],
  };
}

async function generateCompatibleAdminBulkGenerateImportItemBatch(
  input: AdminBulkGenerateImportGenerateInput,
  provider?: "deepseek" | "kimi" | "custom",
): Promise<AdminImportBatch> {
  return chatJson<AdminImportBatch>({
    ...(provider
      ? {
          env: {
            AI_PROVIDER: provider,
            AI_API_KEY: process.env.AI_API_KEY,
            AI_BASE_URL: process.env.AI_BASE_URL,
            AI_MODEL: process.env.AI_MODEL,
          },
        }
      : {}),
    messages: [
      {
        role: "system",
        content: [
          "所有提示词必须使用中文。你是 KnowledgeVault 的后台批量生成导入助手。",
          "只返回严格 JSON，不要包含 Markdown 代码块、解释文字或额外评论。",
          "JSON 必须符合以下 schema：",
          JSON.stringify(createAdminImportJsonSchema().schema),
          "这次输入的一行是知识点标题或短语，不是一篇完整文章。",
          "生成 exactly one 个知识项：items 必须恰好包含 1 个元素。",
          `contentType 必须严格等于：${input.contentType}`,
          `domain 必须严格等于：${input.domain}`,
          input.subdomain
            ? `subdomain 必须严格等于：${input.subdomain}`
            : "subdomain 可以为空或根据知识点推断为中文子领域。",
          "relations 必须返回空数组。",
          "主要内容必须使用中文，包括 title、summary、body、intuition、deepDive、useConditions、nonUseConditions、antiPatterns、typicalProblems、examples、tags 和 reviewItems。",
          "外语词汇、专有名词、代码、公式、LaTeX、英文原文引用可以保留原文，但解释、定义、题目和答案仍应以中文为主。",
          "为所选 contentType 生成完整、可渲染的 renderPayload。",
          "至少生成 1 道复习题，优先生成 recall、recognition、application 中最适合该知识点的题型。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `知识点标题或短语：${input.sourceText}`,
          `固定内容类型：${input.contentType}`,
          `固定领域：${input.domain}`,
          `固定子领域：${input.subdomain ?? ""}`,
        ].join("\n"),
      },
    ],
    temperature: 0.1,
  });
}

function buildMockRenderPayload(contentType: KnowledgeItemType, sourceText: string) {
  if (contentType === "math_formula") {
    return { latex: sourceText.includes("=") ? sourceText : "a + b = c" };
  }

  if (contentType === "vocabulary") {
    return {
      term: sourceText,
      definition: `${sourceText}的中文释义。`,
      phonetic: "",
      partOfSpeech: "名词",
      examples: [`${sourceText}可以放进例句中理解。`],
    };
  }

  if (contentType === "concept_card") {
    return {
      definition: `${sourceText}的定义。`,
      intuition: `把${sourceText}看作一个可复述的核心概念。`,
      keyPoints: [`定义${sourceText}`, "适用条件", "常见误区"],
      examples: [`${sourceText}的例子`],
      misconceptions: [`只背${sourceText}名称`],
    };
  }

  if (contentType === "comparison_table") {
    return {
      mode: "matrix",
      subjects: [sourceText, `非${sourceText}`],
      aspects: [
        {
          label: "核心区别",
          values: [`围绕${sourceText}`, "不满足该知识点条件"],
        },
      ],
    };
  }

  if (contentType === "procedure") {
    return {
      mode: "flowchart",
      title: sourceText,
      overview: `处理${sourceText}的基本流程。`,
      steps: [
        {
          id: "understand",
          title: "理解题意",
          description: `确认${sourceText}涉及的条件。`,
          tips: ["先识别关键词"],
          pitfalls: ["忽略边界条件"],
        },
      ],
      nodes: [
        { id: "start", label: "开始", kind: "start" },
        { id: "understand", label: "理解题意", kind: "step" },
        { id: "end", label: "完成", kind: "end" },
      ],
      edges: [
        { from: "start", to: "understand", label: null },
        { from: "understand", to: "end", label: null },
      ],
    };
  }

  return { text: `${sourceText}的核心说明。` };
}

function slugToken(value: string) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii || `item-${hashText(value)}`;
}

function hashText(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash.toString(36);
}

function normalizeAdminImportProvider(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

function isDirectAiProvider(
  value: string,
): value is "deepseek" | "kimi" | "custom" {
  return value === "deepseek" || value === "kimi" || value === "custom";
}

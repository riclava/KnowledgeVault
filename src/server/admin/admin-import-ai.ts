import type { AdminImportBatch } from "@/server/admin/admin-import-types";
import { chatJson } from "@/server/ai/openai-compatible";

export type AdminImportGenerateInput = {
  sourceMaterial: string;
  sourceTitle?: string;
  defaultDomain?: string;
  defaultSubdomain?: string;
  preferredContentTypes?: string[];
};

type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  enum?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  required?: string[];
  additionalProperties?: false;
  minimum?: number;
  maximum?: number;
  description?: string;
  $defs?: Record<string, JsonSchema>;
};

type AdminImportJsonSchemaFormat = {
  type: "json_schema";
  name: "knowledge_vault_admin_import_batch";
  strict: true;
  schema: JsonSchema;
};

const stringSchema = { type: "string" } as const;
const stringArraySchema = {
  type: "array",
  items: stringSchema,
} as const satisfies JsonSchema;
const nullableStringSchema = {
  type: ["string", "null"],
} as const satisfies JsonSchema;

export function createAdminImportJsonSchema(): AdminImportJsonSchemaFormat {
  return {
    type: "json_schema",
    name: "knowledge_vault_admin_import_batch",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["sourceTitle", "defaultDomain", "items", "relations"],
      properties: {
        sourceTitle: stringSchema,
        defaultDomain: stringSchema,
        items: {
          type: "array",
          items: { $ref: "#/$defs/item" },
        },
        relations: {
          type: "array",
          items: { $ref: "#/$defs/relation" },
        },
      },
      $defs: {
        item: {
          type: "object",
          additionalProperties: false,
          required: [
            "slug",
            "title",
            "contentType",
            "renderPayload",
            "domain",
            "subdomain",
            "summary",
            "body",
            "tags",
            "difficulty",
            "questions",
          ],
          properties: {
            slug: {
              ...stringSchema,
              description: "用于 URL 的小写英文短横线标识。",
            },
            title: stringSchema,
            contentType: {
              type: "string",
              enum: [
                "math_formula",
                "vocabulary",
                "plain_text",
                "concept_card",
                "comparison_table",
                "procedure",
              ],
            },
            renderPayload: {
              anyOf: [
                { $ref: "#/$defs/mathFormulaPayload" },
                { $ref: "#/$defs/vocabularyPayload" },
                { $ref: "#/$defs/plainTextPayload" },
                { $ref: "#/$defs/conceptCardPayload" },
                { $ref: "#/$defs/comparisonTablePayload" },
                { $ref: "#/$defs/procedurePayload" },
              ],
            },
            domain: stringSchema,
            subdomain: nullableStringSchema,
            summary: stringSchema,
            body: stringSchema,
            tags: stringArraySchema,
            difficulty: { type: "integer", minimum: 1, maximum: 5 },
            questions: {
              type: "array",
              items: { $ref: "#/$defs/question" },
            },
          },
        },
        relation: {
          type: "object",
          additionalProperties: false,
          required: ["fromSlug", "toSlug", "relationType", "note"],
          properties: {
            fromSlug: stringSchema,
            toSlug: stringSchema,
            relationType: {
              type: "string",
              enum: ["prerequisite", "related", "confusable", "application_of"],
            },
            note: nullableStringSchema,
          },
        },
        question: {
          type: "object",
          additionalProperties: false,
          required: ["type", "prompt", "answer", "explanation", "difficulty"],
          properties: {
            type: {
              type: "string",
              enum: ["fill_blank", "single_choice", "short_answer"],
            },
            prompt: stringSchema,
            answer: stringSchema,
            explanation: nullableStringSchema,
            difficulty: { type: "integer", minimum: 1, maximum: 5 },
          },
        },
        mathFormulaPayload: {
          type: "object",
          additionalProperties: false,
          required: ["latex", "explanation", "variables"],
          properties: {
            latex: stringSchema,
            explanation: stringSchema,
            variables: {
              type: "array",
              items: { $ref: "#/$defs/mathFormulaVariable" },
            },
          },
        },
        mathFormulaVariable: {
          type: "object",
          additionalProperties: false,
          required: ["symbol", "name", "meaning"],
          properties: {
            symbol: stringSchema,
            name: stringSchema,
            meaning: stringSchema,
          },
        },
        vocabularyPayload: {
          type: "object",
          additionalProperties: false,
          required: ["term", "definition", "examples"],
          properties: {
            term: stringSchema,
            definition: stringSchema,
            examples: stringArraySchema,
          },
        },
        plainTextPayload: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: stringSchema,
          },
        },
        conceptCardPayload: {
          type: "object",
          additionalProperties: false,
          required: ["definition", "keyPoints", "misconceptions"],
          properties: {
            definition: stringSchema,
            keyPoints: stringArraySchema,
            misconceptions: stringArraySchema,
          },
        },
        comparisonTablePayload: {
          type: "object",
          additionalProperties: false,
          required: ["subjects", "aspects"],
          properties: {
            subjects: stringArraySchema,
            aspects: {
              type: "array",
              items: { $ref: "#/$defs/comparisonAspect" },
            },
          },
        },
        comparisonAspect: {
          type: "object",
          additionalProperties: false,
          required: ["label", "values"],
          properties: {
            label: stringSchema,
            values: stringArraySchema,
          },
        },
        procedurePayload: {
          type: "object",
          additionalProperties: false,
          required: ["steps", "pitfalls"],
          properties: {
            steps: {
              type: "array",
              items: { $ref: "#/$defs/procedureStep" },
            },
            pitfalls: stringArraySchema,
          },
        },
        procedureStep: {
          type: "object",
          additionalProperties: false,
          required: ["title", "detail"],
          properties: {
            title: stringSchema,
            detail: stringSchema,
          },
        },
      },
    },
  };
}

export async function generateAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  const provider = normalizeAdminImportProvider(process.env.ADMIN_IMPORT_PROVIDER);
  const globalAiProvider = normalizeAdminImportProvider(process.env.AI_PROVIDER);

  if (provider === "mock") {
    return generateMockAdminImportBatch(input);
  }

  if (provider === "ai" || provider === "openai-compatible") {
    return generateCompatibleAdminImportBatch(input);
  }

  if (isDirectAiProvider(provider)) {
    return generateCompatibleAdminImportBatch(input, provider);
  }

  if (!provider && isDirectAiProvider(globalAiProvider)) {
    return generateCompatibleAdminImportBatch(input);
  }

  if (!provider) {
    return generateMockAdminImportBatch(input);
  }

  throw new Error(`Unsupported ADMIN_IMPORT_PROVIDER: ${provider}`);
}

export async function generateMockAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  const sourceText = input.sourceMaterial.trim();
  const inferredDomain = input.defaultDomain ?? "通用学习";

  return {
    sourceTitle: input.sourceTitle ?? "Mock admin import",
    defaultDomain: inferredDomain,
    items: [
      {
        slug: "mock-linear-equation",
        title: "线性方程",
        contentType: "plain_text",
        renderPayload: {
          text: "线性方程是未知数最高次数为一的方程。",
        },
        domain: inferredDomain,
        subdomain: input.defaultSubdomain,
        summary: "线性方程是一类最高次数为一的方程。",
        body:
          sourceText ||
          "线性方程可以通过等式两边同做逆运算，将未知数隔离出来求解。",
        tags: ["线性方程", "代数", "方程"],
        difficulty: 1,
        questions: [
          {
            type: "fill_blank",
            prompt: "什么是线性方程？",
            answer: "未知数最高次数为一的方程。",
            explanation: "次数由未知数出现的最高幂决定。",
            difficulty: 1,
          },
          {
            type: "single_choice",
            prompt: "2x + 3 = 7 是线性方程吗？",
            answer: "是。",
            explanation: "未知数 x 的最高次数为一。",
            difficulty: 1,
          },
          {
            type: "short_answer",
            prompt: "求解 2x + 3 = 7。",
            answer: "x = 2。",
            explanation: "两边减 3 得 2x = 4，再两边除以 2。",
            difficulty: 1,
          },
        ],
      },
      {
        slug: "mock-linear-equation-concept",
        title: "线性方程概念卡",
        contentType: "concept_card",
        renderPayload: {
          definition: "线性方程是未知数最高次数为一的方程。",
          keyPoints: ["最高次数为一", "可整理为 ax + b = 0", "a 不能为 0"],
          misconceptions: ["含有一个未知数就一定是线性方程", "移项时符号不用改变"],
        },
        domain: inferredDomain,
        subdomain: input.defaultSubdomain,
        summary: "线性方程的核心是一次关系和保持等式平衡。",
        body: sourceText || "线性方程求解依赖等式两边执行同样操作。",
        tags: ["线性方程", "概念卡"],
        difficulty: 1,
        questions: [
          {
            type: "fill_blank",
            prompt: "线性方程的关键判定条件是什么？",
            answer: "未知数最高次数为一。",
            explanation: "线性指一次关系。",
            difficulty: 1,
          },
        ],
      },
      {
        slug: "mock-equation-comparison",
        title: "线性方程与二次方程对比",
        contentType: "comparison_table",
        renderPayload: {
          subjects: ["线性方程", "二次方程"],
          aspects: [
            {
              label: "最高次数",
              values: ["1", "2"],
            },
            {
              label: "图像直觉",
              values: ["直线", "抛物线"],
            },
          ],
        },
        domain: inferredDomain,
        subdomain: input.defaultSubdomain,
        summary: "通过最高次数和图像直觉区分线性方程与二次方程。",
        body: "对比表帮助快速识别相近方程类型。",
        tags: ["对比", "方程"],
        difficulty: 2,
        questions: [
          {
            type: "single_choice",
            prompt: "x^2 + 2x + 1 = 0 是线性方程吗？",
            answer: "不是，它是二次方程。",
            explanation: "未知数最高次数为二。",
            difficulty: 2,
          },
        ],
      },
      {
        slug: "mock-solve-linear-equation-procedure",
        title: "求解线性方程流程",
        contentType: "procedure",
        renderPayload: {
          steps: [
            {
              title: "整理方程",
              detail: "合并同类项，把方程整理成 ax + b = c 的形式。",
            },
            {
              title: "隔离未知数",
              detail: "两边同加减常数，再同除以未知数系数。",
            },
          ],
          pitfalls: ["漏乘括号内每一项", "移项忘记变号"],
        },
        domain: inferredDomain,
        subdomain: input.defaultSubdomain,
        summary: "求解线性方程的流程是整理、隔离未知数、得到解。",
        body: "流程型知识适合表达稳定的解题步骤。",
        tags: ["流程", "解题步骤"],
        difficulty: 2,
        questions: [
          {
            type: "short_answer",
            prompt: "求解 2x + 3 = 7 的第一步通常是什么？",
            answer: "两边先减 3，得到 2x = 4。",
            explanation: "先用逆运算移走常数项。",
            difficulty: 1,
          },
        ],
      },
    ],
    relations: [],
  };
}

async function generateCompatibleAdminImportBatch(
  input: AdminImportGenerateInput,
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
          "所有提示词必须使用中文。你是 KnowledgeVault 的后台知识导入助手，负责把来源材料整理成后台导入批次。",
          "只返回严格 JSON，不要包含 Markdown 代码块、解释文字或额外评论。",
          "JSON 必须符合以下 schema：",
          JSON.stringify(createAdminImportJsonSchema().schema),
          "主要内容必须使用中文，包括 title、summary、body、tags、questions 和 relation.note。",
          "外语词汇、专有名词、代码、公式、LaTeX、英文原文引用可以保留原文，但解释、定义、题目和答案仍应以中文为主。",
          "defaultDomain、domain 和 subdomain 必须使用中文；如果管理员提供了英文领域或子领域，请翻译或重新推断为中文，不要原样复制英文值。",
          "当管理员留空来源标题、默认领域或子领域时，请根据来源材料自行推断。",
          "从来源材料中选择最具体的领域和子领域；例如：数学/概率、数学/代数、语言/词汇、计算机科学/算法、产品/策略。",
          "默认领域、默认子领域和偏好内容类型只是参考，不是硬约束；如果来源材料显示更合适的选择，请覆盖它们。",
          "根据知识形态为每个知识项选择唯一且最合适的 contentType，不要只根据表面关键词或管理员偏好选择。",
          "当长期要记住的是公式、符号规则、方程或推导时，使用 math_formula，并提供干净的 LaTeX。",
          "当长期要记住的是词语、定义和用法例句时，使用 vocabulary。",
          "当内容适合定义、关键点和误区时，使用 concept_card。",
          "当来源材料要求学习者对比或区分相关、易混概念时，使用 comparison_table。",
          "当来源材料描述有顺序的操作、算法、决策流程或解题过程时，使用 procedure；只输出结构化 steps 和 pitfalls。",
          "只有在没有更合适的结构化类型时，才使用 plain_text。",
          "如果来源材料中不同部分最适合不同 contentType，请拆成多个知识项；为前置、应用和易混关系创建 relations。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `来源标题：${input.sourceTitle ?? ""}`,
          `默认领域：${input.defaultDomain ?? ""}`,
          `默认子领域：${input.defaultSubdomain ?? ""}`,
          `偏好内容类型：${(input.preferredContentTypes ?? []).join(", ")}`,
          "来源材料：",
          input.sourceMaterial,
        ].join("\n"),
      },
    ],
    temperature: 0.1,
  });
}

function normalizeAdminImportProvider(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

function isDirectAiProvider(
  value: string,
): value is "deepseek" | "kimi" | "custom" {
  return value === "deepseek" || value === "kimi" || value === "custom";
}

import type { AdminImportBatch } from "@/server/admin/admin-import-types";

export type AdminImportGenerateInput = {
  sourceMaterial: string;
  sourceTitle?: string;
  defaultDomain: string;
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
            "intuition",
            "deepDive",
            "useConditions",
            "nonUseConditions",
            "antiPatterns",
            "typicalProblems",
            "examples",
            "tags",
            "difficulty",
            "variables",
            "reviewItems",
          ],
          properties: {
            slug: {
              ...stringSchema,
              description: "URL-safe lowercase words separated by hyphens.",
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
            intuition: nullableStringSchema,
            deepDive: nullableStringSchema,
            useConditions: stringArraySchema,
            nonUseConditions: stringArraySchema,
            antiPatterns: stringArraySchema,
            typicalProblems: stringArraySchema,
            examples: stringArraySchema,
            tags: stringArraySchema,
            difficulty: { type: "integer", minimum: 1, maximum: 5 },
            variables: {
              type: "array",
              items: { $ref: "#/$defs/variable" },
            },
            reviewItems: {
              type: "array",
              items: { $ref: "#/$defs/reviewItem" },
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
        variable: {
          type: "object",
          additionalProperties: false,
          required: ["symbol", "name", "description", "unit", "sortOrder"],
          properties: {
            symbol: stringSchema,
            name: stringSchema,
            description: stringSchema,
            unit: nullableStringSchema,
            sortOrder: { type: "integer", minimum: 0 },
          },
        },
        reviewItem: {
          type: "object",
          additionalProperties: false,
          required: ["type", "prompt", "answer", "explanation", "difficulty"],
          properties: {
            type: {
              type: "string",
              enum: ["recall", "recognition", "application"],
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
          required: ["latex"],
          properties: {
            latex: stringSchema,
          },
        },
        vocabularyPayload: {
          type: "object",
          additionalProperties: false,
          required: ["term", "definition", "phonetic", "partOfSpeech", "examples"],
          properties: {
            term: stringSchema,
            definition: stringSchema,
            phonetic: stringSchema,
            partOfSpeech: stringSchema,
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
          required: [
            "definition",
            "intuition",
            "keyPoints",
            "examples",
            "misconceptions",
          ],
          properties: {
            definition: stringSchema,
            intuition: stringSchema,
            keyPoints: stringArraySchema,
            examples: stringArraySchema,
            misconceptions: stringArraySchema,
          },
        },
        comparisonTablePayload: {
          anyOf: [
            { $ref: "#/$defs/comparisonMatrixPayload" },
            { $ref: "#/$defs/comparisonGenericTablePayload" },
          ],
        },
        comparisonMatrixPayload: {
          type: "object",
          additionalProperties: false,
          required: ["mode", "subjects", "aspects"],
          properties: {
            mode: {
              type: "string",
              enum: ["matrix"],
            },
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
        comparisonGenericTablePayload: {
          type: "object",
          additionalProperties: false,
          required: ["mode", "columns", "rows"],
          properties: {
            mode: {
              type: "string",
              enum: ["table"],
            },
            columns: stringArraySchema,
            rows: {
              type: "array",
              items: {
                type: "array",
                items: stringSchema,
              },
            },
          },
        },
        procedurePayload: {
          type: "object",
          additionalProperties: false,
          required: [
            "mode",
            "title",
            "overview",
            "steps",
            "nodes",
            "edges",
            "mermaid",
          ],
          properties: {
            mode: {
              type: "string",
              enum: ["flowchart"],
            },
            title: stringSchema,
            overview: stringSchema,
            steps: {
              type: "array",
              items: { $ref: "#/$defs/procedureStep" },
            },
            nodes: {
              type: "array",
              items: { $ref: "#/$defs/procedureNode" },
            },
            edges: {
              type: "array",
              items: { $ref: "#/$defs/procedureEdge" },
            },
            mermaid: stringSchema,
          },
        },
        procedureStep: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "description", "tips", "pitfalls"],
          properties: {
            id: stringSchema,
            title: stringSchema,
            description: stringSchema,
            tips: stringArraySchema,
            pitfalls: stringArraySchema,
          },
        },
        procedureNode: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "kind"],
          properties: {
            id: stringSchema,
            label: stringSchema,
            kind: {
              type: "string",
              enum: ["start", "step", "decision", "end"],
            },
          },
        },
        procedureEdge: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to", "label"],
          properties: {
            from: stringSchema,
            to: stringSchema,
            label: nullableStringSchema,
          },
        },
      },
    },
  };
}

export async function generateAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  const provider = process.env.ADMIN_IMPORT_PROVIDER ?? "mock";

  if (provider === "mock") {
    return generateMockAdminImportBatch(input);
  }

  if (provider === "openai") {
    return generateOpenAiAdminImportBatch(input);
  }

  throw new Error(`Unsupported ADMIN_IMPORT_PROVIDER: ${provider}`);
}

export async function generateMockAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  const sourceText = input.sourceMaterial.trim();

  return {
    sourceTitle: input.sourceTitle ?? "Mock admin import",
    defaultDomain: input.defaultDomain,
    items: [
      {
        slug: "mock-linear-equation",
        title: "线性方程",
        contentType: "plain_text",
        renderPayload: {
          text: "线性方程是未知数最高次数为一的方程。",
        },
        domain: input.defaultDomain,
        subdomain: input.defaultSubdomain,
        summary: "线性方程是一类最高次数为一的方程。",
        body:
          sourceText ||
          "线性方程可以通过等式两边同做逆运算，将未知数隔离出来求解。",
        intuition: "把方程看作保持平衡的天平，每一步都要同时作用在等式两边。",
        deepDive: "标准形式通常可以整理为 ax + b = 0，其中 a 不为 0。",
        useConditions: ["未知数最高次数为一", "可以整理为 ax + b = 0"],
        nonUseConditions: ["含有未知数二次或更高次幂", "未知数出现在分母且无法化为一次形式"],
        antiPatterns: ["移项后忘记变号", "两边同除时忽略系数不能为零"],
        typicalProblems: ["求解 2x + 3 = 7", "判断一个方程是否为线性方程"],
        examples: ["2x + 3 = 7 -> x = 2"],
        tags: ["线性方程", "代数", "方程"],
        difficulty: 1,
        variables: [
          {
            symbol: "x",
            name: "未知数",
            description: "方程中需要求解的量。",
            unit: undefined,
            sortOrder: 0,
          },
        ],
        reviewItems: [
          {
            type: "recall",
            prompt: "什么是线性方程？",
            answer: "未知数最高次数为一的方程。",
            explanation: "次数由未知数出现的最高幂决定。",
            difficulty: 1,
          },
          {
            type: "recognition",
            prompt: "2x + 3 = 7 是线性方程吗？",
            answer: "是。",
            explanation: "未知数 x 的最高次数为一。",
            difficulty: 1,
          },
          {
            type: "application",
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
          intuition: "它描述一条直线关系，求解时目标是把未知数单独留在等号一侧。",
          keyPoints: ["最高次数为一", "可整理为 ax + b = 0", "a 不能为 0"],
          examples: ["2x + 3 = 7", "5y - 1 = 9"],
          misconceptions: ["含有一个未知数就一定是线性方程", "移项时符号不用改变"],
        },
        domain: input.defaultDomain,
        subdomain: input.defaultSubdomain,
        summary: "线性方程的核心是一次关系和保持等式平衡。",
        body: sourceText || "线性方程求解依赖等式两边执行同样操作。",
        intuition: "像维护天平平衡一样处理等号两边。",
        deepDive: "标准形式 ax + b = 0 要求 a 不为 0，否则未知数项消失。",
        useConditions: ["未知数最高次数为一"],
        nonUseConditions: ["未知数出现二次或更高次幂"],
        antiPatterns: ["把含 x^2 的方程当作线性方程"],
        typicalProblems: ["判断方程是否线性", "解释线性方程的标准形式"],
        examples: ["3x - 6 = 0"],
        tags: ["线性方程", "概念卡"],
        difficulty: 1,
        variables: [],
        reviewItems: [
          {
            type: "recall",
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
          mode: "matrix",
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
        domain: input.defaultDomain,
        subdomain: input.defaultSubdomain,
        summary: "通过最高次数和图像直觉区分线性方程与二次方程。",
        body: "对比表帮助快速识别相近方程类型。",
        intuition: "先看未知数最高幂，再判断适用的解法。",
        deepDive: "",
        useConditions: ["需要区分易混方程类型"],
        nonUseConditions: ["只需要求解单个明确方程"],
        antiPatterns: ["只数未知数个数，不看次数"],
        typicalProblems: ["判断 x^2 + x = 0 是否线性"],
        examples: ["2x + 3 = 7 vs x^2 + 2x + 1 = 0"],
        tags: ["对比", "方程"],
        difficulty: 2,
        variables: [],
        reviewItems: [
          {
            type: "recognition",
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
          mode: "flowchart",
          title: "求解线性方程",
          overview: "通过等式两边同做逆运算，把未知数隔离出来。",
          steps: [
            {
              id: "simplify",
              title: "整理方程",
              description: "合并同类项，把方程整理成 ax + b = c 的形式。",
              tips: ["先处理括号", "同类项放在一起"],
              pitfalls: ["漏乘括号内每一项"],
            },
            {
              id: "isolate",
              title: "隔离未知数",
              description: "两边同加减常数，再同除以未知数系数。",
              tips: ["每一步两边都做同样操作"],
              pitfalls: ["移项忘记变号"],
            },
          ],
          nodes: [
            { id: "start", label: "开始", kind: "start" },
            { id: "simplify", label: "整理方程", kind: "step" },
            { id: "isolate", label: "隔离未知数", kind: "step" },
            { id: "end", label: "得到解", kind: "end" },
          ],
          edges: [
            { from: "start", to: "simplify", label: null },
            { from: "simplify", to: "isolate", label: null },
            { from: "isolate", to: "end", label: null },
          ],
          mermaid:
            "flowchart TD\n  start([开始]) --> simplify[整理方程]\n  simplify --> isolate[隔离未知数]\n  isolate --> end([得到解])",
        },
        domain: input.defaultDomain,
        subdomain: input.defaultSubdomain,
        summary: "求解线性方程的流程是整理、隔离未知数、得到解。",
        body: "流程型知识适合表达稳定的解题步骤。",
        intuition: "把复杂方程逐步变成 x = 某个值。",
        deepDive: "每一步变形都必须保持等式两边相等。",
        useConditions: ["方程可以整理为一次形式"],
        nonUseConditions: ["未知数系数为 0", "方程包含不可化简的高次项"],
        antiPatterns: ["只变形等式一边", "除以可能为 0 的量"],
        typicalProblems: ["求解 2x + 3 = 7"],
        examples: ["2x + 3 = 7 -> 2x = 4 -> x = 2"],
        tags: ["流程", "解题步骤"],
        difficulty: 2,
        variables: [],
        reviewItems: [
          {
            type: "application",
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

export function extractResponseOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response payload is not an object.");
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }

  if (Array.isArray(record.output)) {
    for (const outputEntry of record.output) {
      if (!outputEntry || typeof outputEntry !== "object") {
        continue;
      }

      const outputRecord = outputEntry as Record<string, unknown>;

      if (!Array.isArray(outputRecord.content)) {
        continue;
      }

      for (const contentEntry of outputRecord.content) {
        if (!contentEntry || typeof contentEntry !== "object") {
          continue;
        }

        const contentRecord = contentEntry as Record<string, unknown>;

        if (
          contentRecord.type === "output_text" &&
          typeof contentRecord.text === "string" &&
          contentRecord.text.trim()
        ) {
          return contentRecord.text;
        }
      }
    }
  }

  throw new Error("OpenAI response did not include output_text content.");
}

async function generateOpenAiAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when ADMIN_IMPORT_PROVIDER=openai.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMPORT_MODEL ?? "gpt-4.1-mini",
      instructions:
        [
          "You convert source material into a KnowledgeVault admin import batch.",
          "Return only data matching the structured output schema.",
          "Use concept_card for definitions, intuition, key points, examples, and misconceptions.",
          "Use comparison_table when the source contrasts related or confusable ideas; prefer matrix mode unless the source is already tabular.",
          "Use procedure when the source describes ordered operations, algorithms, decision flows, or solving processes; keep Mermaid consistent with nodes and edges.",
        ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Source title: ${input.sourceTitle ?? ""}`,
                `Default domain: ${input.defaultDomain}`,
                `Default subdomain: ${input.defaultSubdomain ?? ""}`,
                `Preferred content types: ${(input.preferredContentTypes ?? []).join(", ")}`,
                "Source material:",
                input.sourceMaterial,
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: createAdminImportJsonSchema(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI admin import request failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload = await response.json();
  const outputText = extractResponseOutputText(payload);

  return JSON.parse(outputText) as AdminImportBatch;
}

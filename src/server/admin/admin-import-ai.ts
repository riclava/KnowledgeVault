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
              enum: ["math_formula", "vocabulary", "plain_text"],
            },
            renderPayload: {
              anyOf: [
                { $ref: "#/$defs/mathFormulaPayload" },
                { $ref: "#/$defs/vocabularyPayload" },
                { $ref: "#/$defs/plainTextPayload" },
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
        "You convert source material into a KnowledgeVault admin import batch. Return only data matching the structured output schema.",
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

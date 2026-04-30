import type {
  NormalizedQuestion,
  QuestionAnswer,
  QuestionGradingMode,
  QuestionType,
} from "@/types/question";

const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "short_answer",
] as const satisfies QuestionType[];

export function parseQuestionType(value: unknown): QuestionType | null {
  return typeof value === "string" && QUESTION_TYPES.includes(value as QuestionType)
    ? (value as QuestionType)
    : null;
}

export function normalizeQuestion(value: unknown): NormalizedQuestion {
  const record = requireRecord(value, "question");
  const type = parseQuestionType(record.type);

  if (!type) {
    throw new Error("question type is not supported");
  }

  const prompt = toText(record.prompt);

  if (!prompt) {
    throw new Error("question prompt is required");
  }

  const difficulty = toDifficulty(record.difficulty);
  const options = normalizeOptionsForType(type, record.options);
  const answer = normalizeAnswerForType(type, record.answer);
  const gradingMode = normalizeGradingMode(record.gradingMode) ?? defaultGradingMode(type);

  return {
    type,
    prompt,
    options,
    answer,
    answerAliases: toTextList(record.answerAliases),
    explanation: toText(record.explanation) || null,
    difficulty,
    tags: toTextList(record.tags),
    gradingMode,
  };
}

export function normalizeSubmittedAnswer(
  type: QuestionType,
  value: unknown,
): QuestionAnswer {
  return normalizeAnswerForType(type, value, "submitted answer");
}

function normalizeOptionsForType(type: QuestionType, value: unknown) {
  if (type === "fill_blank" || type === "short_answer" || type === "true_false") {
    return null;
  }

  const options = Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }

        const id = toText(entry.id);
        const text = toText(entry.text);

        return id && text ? [{ id, text }] : [];
      })
    : [];

  if (options.length === 0) {
    throw new Error(`${type} question options are required`);
  }

  return options;
}

function normalizeAnswerForType(
  type: QuestionType,
  value: unknown,
  label = "answer",
): QuestionAnswer {
  const record = requireRecord(value, label);

  if (type === "single_choice") {
    const optionId = toText(record.optionId);

    if (!optionId) {
      throw new Error(`${label} optionId is required`);
    }

    return { optionId };
  }

  if (type === "multiple_choice") {
    const optionIds = uniqueSortedTextList(record.optionIds);

    if (optionIds.length === 0) {
      throw new Error(`${label} optionIds are required`);
    }

    return { optionIds };
  }

  if (type === "true_false") {
    if (typeof record.value !== "boolean") {
      throw new Error(`${label} value must be boolean`);
    }

    return { value: record.value };
  }

  const text = toText(record.text);

  if (!text) {
    throw new Error(`${label} text answer is required`);
  }

  return { text };
}

function defaultGradingMode(type: QuestionType): QuestionGradingMode {
  return type === "short_answer" ? "ai" : "rule";
}

function normalizeGradingMode(value: unknown): QuestionGradingMode | null {
  if (value === "rule" || value === "ai") {
    return value;
  }

  return null;
}

function toDifficulty(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("question difficulty must be an integer from 1 to 5");
  }

  return value;
}

function uniqueSortedTextList(value: unknown) {
  return Array.from(new Set(toTextList(value))).sort();
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

function toText(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

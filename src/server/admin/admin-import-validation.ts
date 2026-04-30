import {
  normalizeKnowledgeItemRenderPayload,
  parseKnowledgeItemType,
} from "@/lib/knowledge-item-render-payload";
import type {
  AdminImportBatch,
  AdminImportedKnowledgeItem,
  AdminImportedRelation,
  AdminImportedQuestion,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "short_answer",
] as const;
const RELATION_TYPES = [
  "prerequisite",
  "related",
  "confusable",
  "application_of",
] as const;
const STRING_ARRAY_FIELDS = ["tags"] as const;
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

export type AdminImportValidationResult =
  | { ok: true; batch: AdminImportBatch }
  | { ok: false; errors: AdminImportValidationError[] };

export function normalizeAdminImportBatch(
  batch: AdminImportBatch,
): AdminImportBatch {
  const record = batch as unknown as Record<string, unknown>;
  const defaultDomain = optionalString(batch.defaultDomain);
  const items = Array.isArray(record.items)
    ? batch.items.filter(isRecord)
    : [];
  const relations = Array.isArray(record.relations)
    ? batch.relations.filter(isRecord)
    : [];

  return {
    sourceTitle: optionalString(batch.sourceTitle),
    defaultDomain,
    items: items.map((item) => normalizeImportedItem(item, defaultDomain)),
    relations: relations.map(normalizeImportedRelation),
  };
}

export function validateAdminImportBatch(
  batch: AdminImportBatch,
  existingSlugs: Set<string>,
): AdminImportValidationResult {
  const errors: AdminImportValidationError[] = [];
  const record = batch as unknown as Record<string, unknown>;
  const rawItems = record.items;
  const rawRelations = record.relations;

  validateTopLevelArray(rawItems, "items", errors);
  validateTopLevelArray(rawRelations, "relations", errors);
  validateItemArrayFields(rawItems, errors);
  validateRelationArrayFields(rawRelations, errors);

  const normalized = normalizeAdminImportBatch(batch);
  const generatedSlugs = new Set<string>();
  const seenSlugs = new Set<string>();

  if (normalized.items.length === 0) {
    errors.push({
      code: "empty_batch",
      path: "items",
      message: "Import batch must include at least one item.",
    });
  }

  validateChineseDomain(normalized.defaultDomain, "defaultDomain", errors);

  normalized.items.forEach((item, itemIndex) => {
    const path = `items.${itemIndex}`;

    if (!SLUG_PATTERN.test(item.slug)) {
      errors.push({
        code: "invalid_slug",
        path: `${path}.slug`,
        message: "Slug must be URL-safe lowercase words separated by hyphens.",
      });
    }

    if (seenSlugs.has(item.slug)) {
      errors.push({
        code: "duplicate_slug",
        path: `${path}.slug`,
        message: `Duplicate generated slug: ${item.slug}.`,
      });
    } else {
      seenSlugs.add(item.slug);
      generatedSlugs.add(item.slug);
    }

    validateRequiredItemFields(item, path, errors);
    validateChineseDomain(item.domain, `${path}.domain`, errors);
    validateChineseDomain(item.subdomain, `${path}.subdomain`, errors);
    validateContentTypeAndPayload(item, path, errors);
    validateDifficulty(item.difficulty, `${path}.difficulty`, errors);
    validateQuestions(item.questions, `${path}.questions`, errors);
  });

  validateRelations(normalized.relations, generatedSlugs, existingSlugs, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, batch: normalized };
}

function normalizeImportedItem(
  item: AdminImportedKnowledgeItem,
  defaultDomain: string | undefined,
): AdminImportedKnowledgeItem {
  const record = item as unknown as Record<string, unknown>;
  const questions = Array.isArray(record.questions)
    ? item.questions.filter(isRecord)
    : [];

  return {
    ...item,
    slug: text(item.slug),
    title: text(item.title),
    domain: text(item.domain) || defaultDomain || "",
    subdomain: optionalString(item.subdomain),
    summary: text(item.summary),
    body: text(item.body),
    tags: stringList(item.tags),
    questions: questions.map(normalizeImportedQuestion),
  };
}

function normalizeImportedQuestion(
  question: AdminImportedQuestion,
): AdminImportedQuestion {
  return {
    ...question,
    prompt: text(question.prompt),
    answer: text(question.answer),
    explanation: optionalString(question.explanation),
  };
}

function normalizeImportedRelation(
  relation: AdminImportedRelation,
): AdminImportedRelation {
  return {
    ...relation,
    fromSlug: text(relation.fromSlug),
    toSlug: text(relation.toSlug),
    note: optionalString(relation.note),
  };
}

function validateRequiredItemFields(
  item: AdminImportedKnowledgeItem,
  path: string,
  errors: AdminImportValidationError[],
) {
  const fields = ["title", "domain", "summary", "body"] as const;

  fields.forEach((field) => {
    if (!item[field]) {
      errors.push({
        code: "missing_item_field",
        path: `${path}.${field}`,
        message: `Item ${field} is required.`,
      });
    }
  });
}

function validateChineseDomain(
  value: string | undefined,
  path: string,
  errors: AdminImportValidationError[],
) {
  if (!value) {
    return;
  }

  if (!HAN_CHARACTER_PATTERN.test(value)) {
    errors.push({
      code: "non_chinese_domain",
      path,
      message: "领域和子领域必须使用中文。",
    });
  }
}

function validateTopLevelArray(
  value: unknown,
  path: string,
  errors: AdminImportValidationError[],
) {
  if (!Array.isArray(value)) {
    errors.push({
      code: "invalid_array_field",
      path,
      message: `${path} must be an array.`,
    });
  }
}

function validateItemArrayFields(
  items: unknown,
  errors: AdminImportValidationError[],
) {
  if (!Array.isArray(items)) {
    return;
  }

  items.forEach((item, itemIndex) => {
    if (!isRecord(item)) {
      errors.push({
        code: "invalid_array_field",
        path: `items.${itemIndex}`,
        message: "Item entries must be objects.",
      });
      return;
    }

    const record = item as Record<string, unknown>;

    STRING_ARRAY_FIELDS.forEach((field) => {
      const value = record[field];
      const path = `items.${itemIndex}.${field}`;

      if (!Array.isArray(value)) {
        errors.push({
          code: "invalid_array_field",
          path,
          message: `Item ${field} must be an array of strings.`,
        });
        return;
      }

      value.forEach((entry, entryIndex) => {
        if (typeof entry !== "string") {
          errors.push({
            code: "invalid_array_field",
            path: `${path}.${entryIndex}`,
            message: `Item ${field} must contain only strings.`,
          });
        }
      });
    });

    validateItemCollectionField(
      record.questions,
      `items.${itemIndex}.questions`,
      errors,
    );
  });
}

function validateRelationArrayFields(
  relations: unknown,
  errors: AdminImportValidationError[],
) {
  if (!Array.isArray(relations)) {
    return;
  }

  relations.forEach((relation, relationIndex) => {
    if (!isRecord(relation)) {
      errors.push({
        code: "invalid_array_field",
        path: `relations.${relationIndex}`,
        message: "Relation entries must be objects.",
      });
    }
  });
}

function validateItemCollectionField(
  value: unknown,
  path: string,
  errors: AdminImportValidationError[],
) {
  if (!Array.isArray(value)) {
    errors.push({
      code: "invalid_array_field",
      path,
      message: `${path} must be an array.`,
    });
    return;
  }

  value.forEach((entry, entryIndex) => {
    if (!isRecord(entry)) {
      errors.push({
        code: "invalid_array_field",
        path: `${path}.${entryIndex}`,
        message: `${path} entries must be objects.`,
      });
    }
  });
}

function validateContentTypeAndPayload(
  item: AdminImportedKnowledgeItem,
  path: string,
  errors: AdminImportValidationError[],
) {
  const contentType = parseKnowledgeItemType(item.contentType);

  if (!contentType) {
    errors.push({
      code: "invalid_content_type",
      path: `${path}.contentType`,
      message: "Content type is not supported.",
    });
    return;
  }

  try {
    item.renderPayload = normalizeKnowledgeItemRenderPayload(
      contentType,
      item.renderPayload,
    );
  } catch (error) {
    errors.push({
      code: "invalid_render_payload",
      path: `${path}.renderPayload`,
      message: error instanceof Error ? error.message : "Invalid render payload.",
    });
  }
}

function validateDifficulty(
  difficulty: number,
  path: string,
  errors: AdminImportValidationError[],
) {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    errors.push({
      code: "invalid_difficulty",
      path,
      message: "Difficulty must be an integer from 1 to 5.",
    });
  }
}

function validateQuestions(
  questions: AdminImportedQuestion[],
  path: string,
  errors: AdminImportValidationError[],
) {
  if (questions.length === 0) {
    errors.push({
      code: "missing_question",
      path,
      message: "Each item must include at least one question.",
    });
    return;
  }

  questions.forEach((question, reviewIndex) => {
    const reviewPath = `${path}.${reviewIndex}`;

    if (!QUESTION_TYPES.includes(question.type)) {
      errors.push({
        code: "invalid_question",
        path: `${reviewPath}.type`,
        message: "Question type is not supported.",
      });
    }

    if (!question.prompt) {
      errors.push({
        code: "invalid_question",
        path: `${reviewPath}.prompt`,
        message: "Question prompt is required.",
      });
    }

    if (!question.answer) {
      errors.push({
        code: "invalid_question",
        path: `${reviewPath}.answer`,
        message: "Question answer is required.",
      });
    }

    validateDifficulty(question.difficulty, `${reviewPath}.difficulty`, errors);
  });
}

function validateRelations(
  relations: AdminImportedRelation[],
  generatedSlugs: Set<string>,
  existingSlugs: Set<string>,
  errors: AdminImportValidationError[],
) {
  const relationTriplets = new Set<string>();

  relations.forEach((relation, relationIndex) => {
    const path = `relations.${relationIndex}`;
    const triplet = `${relation.fromSlug}\0${relation.toSlug}\0${relation.relationType}`;

    if (!RELATION_TYPES.includes(relation.relationType)) {
      errors.push({
        code: "invalid_relation_type",
        path: `${path}.relationType`,
        message: "Relation type is not supported.",
      });
    }

    if (!generatedSlugs.has(relation.fromSlug)) {
      errors.push({
        code: "unknown_relation_source",
        path: `${path}.fromSlug`,
        message: "Relation source must be a generated item in this batch.",
      });
    }

    if (
      !generatedSlugs.has(relation.toSlug) &&
      !existingSlugs.has(relation.toSlug)
    ) {
      errors.push({
        code: "unknown_relation_target",
        path: `${path}.toSlug`,
        message: "Relation target must be generated or pre-existing.",
      });
    }

    if (relation.fromSlug === relation.toSlug) {
      errors.push({
        code: "self_relation",
        path,
        message: "Relation source and target cannot be the same item.",
      });
    }

    if (relationTriplets.has(triplet)) {
      errors.push({
        code: "duplicate_relation",
        path,
        message: "Duplicate relation triplet.",
      });
    } else {
      relationTriplets.add(triplet);
    }
  });
}

function optionalString(value: string | undefined) {
  const trimmed = text(value);

  return trimmed || undefined;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function stringList(values: unknown) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  if (!Array.isArray(values)) {
    return normalized;
  }

  values.forEach((value) => {
    if (typeof value !== "string") {
      return;
    }

    const item = value.trim();

    if (item && !seen.has(item)) {
      seen.add(item);
      normalized.push(item);
    }
  });

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

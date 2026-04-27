import {
  normalizeKnowledgeItemRenderPayload,
  parseKnowledgeItemType,
} from "@/lib/knowledge-item-render-payload";
import type {
  AdminImportBatch,
  AdminImportedKnowledgeItem,
  AdminImportedRelation,
  AdminImportedReviewItem,
  AdminImportedVariable,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REVIEW_ITEM_TYPES = ["recall", "recognition", "application"] as const;
const RELATION_TYPES = [
  "prerequisite",
  "related",
  "confusable",
  "application_of",
] as const;

export type AdminImportValidationResult =
  | { ok: true; batch: AdminImportBatch }
  | { ok: false; errors: AdminImportValidationError[] };

export function normalizeAdminImportBatch(
  batch: AdminImportBatch,
): AdminImportBatch {
  const defaultDomain = optionalString(batch.defaultDomain);

  return {
    sourceTitle: optionalString(batch.sourceTitle),
    defaultDomain,
    items: batch.items.map((item) => normalizeImportedItem(item, defaultDomain)),
    relations: batch.relations.map(normalizeImportedRelation),
  };
}

export function validateAdminImportBatch(
  batch: AdminImportBatch,
  existingSlugs: Set<string>,
): AdminImportValidationResult {
  const normalized = normalizeAdminImportBatch(batch);
  const errors: AdminImportValidationError[] = [];
  const generatedSlugs = new Set<string>();
  const seenSlugs = new Set<string>();

  if (normalized.items.length === 0) {
    errors.push({
      code: "empty_batch",
      path: "items",
      message: "Import batch must include at least one item.",
    });
  }

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
    validateContentTypeAndPayload(item, path, errors);
    validateDifficulty(item.difficulty, `${path}.difficulty`, errors);
    validateReviewItems(item.reviewItems, `${path}.reviewItems`, errors);
    validateVariables(item.variables, `${path}.variables`, errors);
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
  return {
    ...item,
    slug: text(item.slug),
    title: text(item.title),
    domain: text(item.domain) || defaultDomain || "",
    subdomain: optionalString(item.subdomain),
    summary: text(item.summary),
    body: text(item.body),
    intuition: optionalString(item.intuition),
    deepDive: optionalString(item.deepDive),
    useConditions: stringList(item.useConditions),
    nonUseConditions: stringList(item.nonUseConditions),
    antiPatterns: stringList(item.antiPatterns),
    typicalProblems: stringList(item.typicalProblems),
    examples: stringList(item.examples),
    tags: stringList(item.tags),
    variables: item.variables.map(normalizeImportedVariable),
    reviewItems: item.reviewItems.map(normalizeImportedReviewItem),
  };
}

function normalizeImportedVariable(
  variable: AdminImportedVariable,
  index: number,
): AdminImportedVariable {
  return {
    symbol: text(variable.symbol),
    name: text(variable.name),
    description: text(variable.description),
    unit: optionalString(variable.unit),
    sortOrder:
      Number.isInteger(variable.sortOrder) && variable.sortOrder >= 0
        ? variable.sortOrder
        : index,
  };
}

function normalizeImportedReviewItem(
  reviewItem: AdminImportedReviewItem,
): AdminImportedReviewItem {
  return {
    ...reviewItem,
    prompt: text(reviewItem.prompt),
    answer: text(reviewItem.answer),
    explanation: optionalString(reviewItem.explanation),
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

function validateReviewItems(
  reviewItems: AdminImportedReviewItem[],
  path: string,
  errors: AdminImportValidationError[],
) {
  if (reviewItems.length === 0) {
    errors.push({
      code: "missing_review_item",
      path,
      message: "Each item must include at least one review item.",
    });
    return;
  }

  reviewItems.forEach((reviewItem, reviewIndex) => {
    const reviewPath = `${path}.${reviewIndex}`;

    if (!REVIEW_ITEM_TYPES.includes(reviewItem.type)) {
      errors.push({
        code: "invalid_review_item",
        path: `${reviewPath}.type`,
        message: "Review item type is not supported.",
      });
    }

    if (!reviewItem.prompt) {
      errors.push({
        code: "invalid_review_item",
        path: `${reviewPath}.prompt`,
        message: "Review item prompt is required.",
      });
    }

    if (!reviewItem.answer) {
      errors.push({
        code: "invalid_review_item",
        path: `${reviewPath}.answer`,
        message: "Review item answer is required.",
      });
    }

    validateDifficulty(reviewItem.difficulty, `${reviewPath}.difficulty`, errors);
  });
}

function validateVariables(
  variables: AdminImportedVariable[],
  path: string,
  errors: AdminImportValidationError[],
) {
  const symbols = new Set<string>();

  variables.forEach((variable, variableIndex) => {
    if (symbols.has(variable.symbol)) {
      errors.push({
        code: "duplicate_variable",
        path: `${path}.${variableIndex}.symbol`,
        message: `Duplicate variable symbol: ${variable.symbol}.`,
      });
    } else {
      symbols.add(variable.symbol);
    }
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

function stringList(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const item = text(value);

    if (item && !seen.has(item)) {
      seen.add(item);
      normalized.push(item);
    }
  });

  return normalized;
}

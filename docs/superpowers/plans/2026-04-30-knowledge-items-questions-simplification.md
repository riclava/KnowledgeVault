# Knowledge Items And Questions Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify all six knowledge item content types and replace embedded review items with an independent, bindable question module with automatic grading.

**Architecture:** Keep the current enum-plus-renderPayload knowledge item model, but reduce global columns and simplify each payload to the confirmed spec. Replace `ReviewItem` and `ReviewLog` with `Question`, `QuestionKnowledgeItem`, and `QuestionAttempt`; review, diagnostic, practice, admin import, and seed data consume questions while `UserKnowledgeItemState` remains the scheduling source of truth.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma/Postgres, Node test runner, OpenAI-compatible AI grading.

---

## File Structure

- Modify `prisma/schema.prisma`: remove old knowledge columns, `KnowledgeItemVariable`, `ReviewItem`, and `ReviewLog`; add `QuestionType`, `QuestionGradingMode`, `QuestionAttemptResult`, `Question`, `QuestionKnowledgeItem`, and `QuestionAttempt`.
- Modify `prisma/migrations/00000000000000_dev_baseline/migration.sql`: mirror the new baseline directly.
- Modify `src/types/knowledge-item.ts`: remove deleted global fields and variable preview, simplify payload types.
- Create `src/types/question.ts`: shared question, answer, attempt, and grading types.
- Modify `src/lib/knowledge-item-render-payload.ts`: normalize simplified payloads and reject old comparison/procedure shapes.
- Create `src/lib/question-validation.ts`: normalize persisted question shapes and submitted answers.
- Create `src/server/services/question-grading-service.ts`: rule grading and AI short-answer grading.
- Modify `src/server/services/review-rules.ts`: map question attempt results to review grades.
- Modify `src/server/repositories/knowledge-item-repository.ts`, `src/server/repositories/review-repository.ts`, and `src/server/repositories/diagnostic-repository.ts`: switch includes/counts from review items to question bindings.
- Modify `src/server/services/knowledge-item-service.ts`, `src/server/services/review-service.ts`, and `src/server/services/diagnostic-service.ts`: return questions and update scheduling by bound knowledge items.
- Modify `src/server/admin/*import*`, `src/components/admin/knowledge-item-admin-form.tsx`, `src/components/admin/admin-import-form.tsx`, and related tests: write/read simplified knowledge fields and questions.
- Modify `src/components/knowledge-item/renderers/*`: render simplified payloads; remove Mermaid procedure dependency from the procedure renderer.
- Create `src/components/question/question-card.tsx`: shared learner-facing question UI.
- Create `src/app/practice/page.tsx` and `src/app/api/practice/*`: standalone practice flow.
- Modify `prisma/seed.ts`: seed simplified knowledge items and one question of each type.

## Task 1: Schema And Baseline Replacement

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/00000000000000_dev_baseline/migration.sql`
- Modify: `tests/unit/admin-schema-shape.test.ts`

- [ ] **Step 1: Write failing schema tests**

Replace the old review-item schema assertions in `tests/unit/admin-schema-shape.test.ts` with tests for the new direct baseline:

```ts
it("simplifies knowledge items and removes embedded review models", () => {
  assert.doesNotMatch(schema, /intuition\s+String\?/);
  assert.doesNotMatch(schema, /deepDive\s+String\?/);
  assert.doesNotMatch(schema, /useConditions\s+String\[\]/);
  assert.doesNotMatch(schema, /model KnowledgeItemVariable\s*{/);
  assert.doesNotMatch(schema, /model ReviewItem\s*{/);
  assert.doesNotMatch(schema, /model ReviewLog\s*{/);
  assert.match(schema, /questionBindings\s+QuestionKnowledgeItem\[\]/);
  assert.doesNotMatch(baseline, /"intuition"/);
  assert.doesNotMatch(baseline, /CREATE TABLE "review_items"/);
  assert.doesNotMatch(baseline, /CREATE TABLE "review_logs"/);
});

it("adds independent questions and knowledge bindings", () => {
  assert.match(schema, /enum QuestionType\s*{\s*single_choice\s*multiple_choice\s*true_false\s*fill_blank\s*short_answer\s*}/s);
  assert.match(schema, /enum QuestionGradingMode\s*{\s*rule\s*ai\s*}/s);
  assert.match(schema, /enum QuestionAttemptResult\s*{\s*correct\s*partial\s*incorrect\s*}/s);
  assert.match(schema, /model Question\s*{/);
  assert.match(schema, /model QuestionKnowledgeItem\s*{/);
  assert.match(schema, /model QuestionAttempt\s*{/);
  assert.match(baseline, /CREATE TYPE "QuestionType" AS ENUM \('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer'\)/);
  assert.match(baseline, /CREATE TABLE "questions"/);
  assert.match(baseline, /CREATE TABLE "question_knowledge_items"/);
  assert.match(baseline, /CREATE TABLE "question_attempts"/);
});
```

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-schema-shape.test.ts
```

Expected: FAIL because the old schema still contains removed fields and lacks question models.

- [ ] **Step 3: Update Prisma schema**

Edit `prisma/schema.prisma` so the core models include this shape:

```prisma
enum QuestionType {
  single_choice
  multiple_choice
  true_false
  fill_blank
  short_answer
}

enum QuestionGradingMode {
  rule
  ai
}

enum QuestionAttemptResult {
  correct
  partial
  incorrect
}

model KnowledgeItem {
  id              String                  @id @default(cuid())
  slug            String                  @unique
  title           String
  contentType     KnowledgeItemType
  renderPayload   Json
  domain          String
  subdomain       String?
  summary         String
  body            String
  difficulty      Int
  tags            String[]
  extension       Json?
  visibility      KnowledgeItemVisibility @default(public)
  createdByUserId String?
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  createdByUser     User?                   @relation("KnowledgeItemCreator", fields: [createdByUserId], references: [id], onDelete: Cascade)
  outgoingRelations KnowledgeItemRelation[] @relation("KnowledgeItemRelationFrom")
  incomingRelations KnowledgeItemRelation[] @relation("KnowledgeItemRelationTo")
  questionBindings  QuestionKnowledgeItem[]
  userStates        UserKnowledgeItemState[]
  memoryHooks       KnowledgeItemMemoryHook[]

  @@index([domain, subdomain])
  @@index([contentType])
  @@index([visibility, createdByUserId])
  @@map("knowledge_items")
}

model Question {
  id              String                  @id @default(cuid())
  type            QuestionType
  prompt          String
  options         Json?
  answer          Json
  answerAliases   String[]
  explanation     String?
  difficulty      Int
  tags            String[]
  gradingMode     QuestionGradingMode
  isActive        Boolean                 @default(true)
  visibility      KnowledgeItemVisibility @default(public)
  createdByUserId String?
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  createdByUser  User?                   @relation("QuestionCreator", fields: [createdByUserId], references: [id], onDelete: Cascade)
  knowledgeItems QuestionKnowledgeItem[]
  attempts       QuestionAttempt[]

  @@index([type])
  @@index([difficulty])
  @@index([visibility, createdByUserId])
  @@map("questions")
}
```

Also add `createdQuestions Question[] @relation("QuestionCreator")` and `questionAttempts QuestionAttempt[]` to `User`; replace `StudySession.reviewLogs` with `StudySession.questionAttempts`.

- [ ] **Step 4: Rebuild the baseline SQL**

Run:

```bash
npm run db:baseline
```

Expected: `prisma/migrations/00000000000000_dev_baseline/migration.sql` is regenerated for the new schema.

- [ ] **Step 5: Generate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: `src/generated/prisma` updates and exports question enums/delegates.

- [ ] **Step 6: Run schema tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-schema-shape.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit schema replacement**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/00000000000000_dev_baseline/migration.sql src/generated/prisma tests/unit/admin-schema-shape.test.ts
git commit -m "refactor: replace review items with questions schema"
```

## Task 2: Simplified Knowledge Payloads

**Files:**
- Modify: `src/types/knowledge-item.ts`
- Modify: `src/lib/knowledge-item-render-payload.ts`
- Modify: `src/components/knowledge-item/renderers/math-formula-renderer.tsx`
- Modify: `src/components/knowledge-item/renderers/vocabulary-renderer.tsx`
- Modify: `src/components/knowledge-item/renderers/concept-card-renderer.tsx`
- Modify: `src/components/knowledge-item/renderers/comparison-table-renderer.tsx`
- Modify: `src/components/knowledge-item/renderers/procedure-renderer.tsx`
- Delete or stop importing: `src/components/knowledge-item/renderers/mermaid-diagram.tsx`
- Modify: `tests/unit/knowledge-item-render-payload.test.ts`
- Modify: `tests/unit/knowledge-item-renderer-registry.test.ts`

- [ ] **Step 1: Write failing simplified payload tests**

Update `tests/unit/knowledge-item-render-payload.test.ts` to assert these normalized outputs:

```ts
assert.deepEqual(
  normalizeKnowledgeItemRenderPayload("math_formula", {
    latex: " E = mc^2 ",
    explanation: "Energy mass equivalence",
    variables: [{ symbol: "E", name: "Energy", meaning: "Total energy" }],
  }),
  {
    latex: "E = mc^2",
    explanation: "Energy mass equivalence",
    variables: [{ symbol: "E", name: "Energy", meaning: "Total energy" }],
  },
);

assert.deepEqual(
  normalizeKnowledgeItemRenderPayload("comparison_table", {
    subjects: ["DFS", "BFS"],
    aspects: [{ label: "Order", values: ["Depth first", "Breadth first", "ignored"] }],
  }),
  {
    subjects: ["DFS", "BFS"],
    aspects: [{ label: "Order", values: ["Depth first", "Breadth first"] }],
  },
);

assert.deepEqual(
  normalizeKnowledgeItemRenderPayload("procedure", {
    steps: [{ title: "Read", detail: "Identify inputs." }],
    pitfalls: "Skip constraints\nAssume sorted input",
  }),
  {
    steps: [{ title: "Read", detail: "Identify inputs." }],
    pitfalls: ["Skip constraints", "Assume sorted input"],
  },
);
```

Also assert old shapes are rejected:

```ts
assert.throws(
  () => normalizeKnowledgeItemRenderPayload("comparison_table", { mode: "table", columns: ["A"], rows: [["B"]] }),
  /subjects/i,
);
assert.throws(
  () => normalizeKnowledgeItemRenderPayload("procedure", { mode: "flowchart", nodes: [], edges: [] }),
  /steps/i,
);
```

- [ ] **Step 2: Run payload tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/knowledge-item-render-payload.test.ts
```

Expected: FAIL because current normalizer expects old fields.

- [ ] **Step 3: Update TypeScript payload types**

Set the payload types in `src/types/knowledge-item.ts` to:

```ts
export type MathFormulaRenderPayload = {
  latex: string;
  explanation: string;
  variables: Array<{ symbol: string; name: string; meaning: string }>;
};

export type VocabularyRenderPayload = {
  term: string;
  definition: string;
  examples: string[];
};

export type ConceptCardRenderPayload = {
  definition: string;
  keyPoints: string[];
  misconceptions: string[];
};

export type ComparisonTableRenderPayload = {
  subjects: string[];
  aspects: Array<{ label: string; values: string[] }>;
};

export type ProcedureRenderPayload = {
  steps: Array<{ title: string; detail: string }>;
  pitfalls: string[];
};
```

Remove `variablePreview`, `intuition`, `deepDive`, `useConditions`, `nonUseConditions`, `antiPatterns`, `typicalProblems`, `examples`, `variables`, and `reviewItems` from public knowledge item types.

- [ ] **Step 4: Update payload normalization**

Replace the `comparison_table` and `procedure` branches in `src/lib/knowledge-item-render-payload.ts` with simplified normalizers:

```ts
function normalizeComparisonTablePayload(record: Record<string, unknown>) {
  const subjects = toTextList(record.subjects);
  if (subjects.length < 2) throw new Error("comparison table requires at least two subjects");

  const aspects = toRecordList(record.aspects).map((aspect) => {
    const label = toText(aspect.label);
    if (!label) throw new Error("comparison table aspect requires label");
    return { label, values: normalizeCells(toTextList(aspect.values), subjects.length) };
  });
  if (aspects.length === 0) throw new Error("comparison table requires at least one aspect");

  return { subjects, aspects };
}

function normalizeProcedurePayload(record: Record<string, unknown>) {
  const steps = toRecordList(record.steps).map((step) => {
    const title = toText(step.title);
    if (!title) throw new Error("procedure step requires title");
    return { title, detail: toText(step.detail) };
  });
  if (steps.length === 0) throw new Error("procedure payload requires at least one step");

  return { steps, pitfalls: toTextList(record.pitfalls) };
}
```

Update math and vocabulary branches to return the simplified fields.

- [ ] **Step 5: Update renderers**

Update the renderers to consume the simplified payloads:

- `math_formula`: render KaTeX, `explanation`, and `variables`.
- `vocabulary`: remove phonetic and part-of-speech UI.
- `concept_card`: remove intuition and examples.
- `comparison_table`: remove `mode` branching.
- `procedure`: remove Mermaid rendering and show numbered steps plus pitfalls.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/knowledge-item-render-payload.test.ts tests/unit/knowledge-item-renderer-registry.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit payload simplification**

Run:

```bash
git add src/types/knowledge-item.ts src/lib/knowledge-item-render-payload.ts src/components/knowledge-item/renderers tests/unit/knowledge-item-render-payload.test.ts tests/unit/knowledge-item-renderer-registry.test.ts
git commit -m "refactor: simplify knowledge item payloads"
```

## Task 3: Question Validation And Grading Core

**Files:**
- Create: `src/types/question.ts`
- Create: `src/lib/question-validation.ts`
- Create: `src/server/services/question-grading-service.ts`
- Modify: `src/server/services/review-rules.ts`
- Create: `tests/unit/question-validation.test.ts`
- Create: `tests/unit/question-grading-service.test.ts`
- Modify: `tests/unit/review-rules.test.ts`

- [ ] **Step 1: Write failing question validation tests**

Create `tests/unit/question-validation.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeQuestion, normalizeSubmittedAnswer } from "@/lib/question-validation";

describe("question validation", () => {
  it("normalizes each supported question type", () => {
    assert.equal(normalizeQuestion({ type: "single_choice", prompt: "Q", options: [{ id: "a", text: "A" }], answer: { optionId: "a" }, difficulty: 2 }).gradingMode, "rule");
    assert.equal(normalizeQuestion({ type: "short_answer", prompt: "Explain", answer: { text: "Because..." }, difficulty: 3 }).gradingMode, "ai");
    assert.deepEqual(normalizeSubmittedAnswer("multiple_choice", { optionIds: ["b", "a", "a"] }), { optionIds: ["a", "b"] });
  });

  it("rejects unsupported question shapes", () => {
    assert.throws(() => normalizeQuestion({ type: "single_choice", prompt: "Q", options: [], answer: { optionId: "a" }, difficulty: 2 }), /options/i);
    assert.throws(() => normalizeQuestion({ type: "fill_blank", prompt: "Q", answer: {}, difficulty: 2 }), /answer/i);
    assert.throws(() => normalizeSubmittedAnswer("true_false", { value: "yes" }), /boolean/i);
  });
});
```

- [ ] **Step 2: Write failing grading tests**

Create `tests/unit/question-grading-service.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gradeQuestionAnswer } from "@/server/services/question-grading-service";

describe("question grading", () => {
  it("grades objective question types with rules", async () => {
    assert.equal((await gradeQuestionAnswer({ question: { type: "single_choice", answer: { optionId: "a" }, answerAliases: [] }, submittedAnswer: { optionId: "a" } })).result, "correct");
    assert.equal((await gradeQuestionAnswer({ question: { type: "multiple_choice", answer: { optionIds: ["a", "c"] }, answerAliases: [] }, submittedAnswer: { optionIds: ["c", "a"] } })).result, "correct");
    assert.equal((await gradeQuestionAnswer({ question: { type: "true_false", answer: { value: true }, answerAliases: [] }, submittedAnswer: { value: false } })).result, "incorrect");
    assert.equal((await gradeQuestionAnswer({ question: { type: "fill_blank", answer: { text: "Bayes" }, answerAliases: ["Bayes theorem"] }, submittedAnswer: { text: " bayes theorem " } })).result, "correct");
  });

  it("uses AI grading for short answers", async () => {
    const result = await gradeQuestionAnswer({
      question: { type: "short_answer", prompt: "Why?", answer: { text: "Because causes update beliefs." }, answerAliases: [], explanation: "Bayesian update" },
      submittedAnswer: { text: "It updates beliefs from evidence." },
      aiGrader: async () => ({ result: "partial", score: 0.6, feedback: "方向对，但缺少原因说明。" }),
    });
    assert.deepEqual(result, { result: "partial", score: 0.6, feedback: "方向对，但缺少原因说明。" });
  });
});
```

- [ ] **Step 3: Run question tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/question-validation.test.ts tests/unit/question-grading-service.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement question types**

Create `src/types/question.ts` with:

```ts
export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "fill_blank" | "short_answer";
export type QuestionGradingMode = "rule" | "ai";
export type QuestionAttemptResult = "correct" | "partial" | "incorrect";

export type QuestionOption = { id: string; text: string };
export type QuestionAnswer =
  | { optionId: string }
  | { optionIds: string[] }
  | { value: boolean }
  | { text: string };

export type NormalizedQuestion = {
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  answer: QuestionAnswer;
  answerAliases: string[];
  explanation: string | null;
  difficulty: number;
  tags: string[];
  gradingMode: QuestionGradingMode;
};
```

- [ ] **Step 5: Implement validation and grading**

Implement `src/lib/question-validation.ts` and `src/server/services/question-grading-service.ts` using the APIs from the tests. `gradeQuestionAnswer` should call `chatJson` from `src/server/ai/openai-compatible.ts` when no injected `aiGrader` is provided for `short_answer`.

- [ ] **Step 6: Add review grade mapping tests**

Extend `tests/unit/review-rules.test.ts`:

```ts
import { mapQuestionAttemptToReviewGrade } from "@/server/services/review-rules";

it("maps question attempt results onto review grades", () => {
  assert.equal(mapQuestionAttemptToReviewGrade({ result: "correct", score: 1 }), "easy");
  assert.equal(mapQuestionAttemptToReviewGrade({ result: "correct", score: 0.8 }), "good");
  assert.equal(mapQuestionAttemptToReviewGrade({ result: "partial", score: 0.6 }), "hard");
  assert.equal(mapQuestionAttemptToReviewGrade({ result: "incorrect", score: 0 }), "again");
});
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/question-validation.test.ts tests/unit/question-grading-service.test.ts tests/unit/review-rules.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit question core**

Run:

```bash
git add src/types/question.ts src/lib/question-validation.ts src/server/services/question-grading-service.ts src/server/services/review-rules.ts tests/unit/question-validation.test.ts tests/unit/question-grading-service.test.ts tests/unit/review-rules.test.ts
git commit -m "feat: add question validation and grading"
```

## Task 4: Services Move From Review Items To Questions

**Files:**
- Modify: `src/types/review.ts`
- Modify: `src/types/diagnostic.ts`
- Modify: `src/server/repositories/review-repository.ts`
- Modify: `src/server/repositories/diagnostic-repository.ts`
- Modify: `src/server/repositories/knowledge-item-repository.ts`
- Modify: `src/server/services/review-service.ts`
- Modify: `src/server/services/diagnostic-service.ts`
- Modify: `src/server/services/diagnostic-rules.ts`
- Modify: `tests/unit/review-item-active-filter.test.ts`
- Modify: `tests/unit/review-ai-hint.test.ts`
- Modify: `tests/unit/diagnostic-rules.test.ts`

- [ ] **Step 1: Update source tests to assert question bindings**

Rename `tests/unit/review-item-active-filter.test.ts` content to question active filtering. The assertions should match `questionBindings` includes, `question: { isActive: true }`, `getActiveQuestionForKnowledgeItem`, and the error string `Question is not active for this knowledge item`.

- [ ] **Step 2: Run service source tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/review-item-active-filter.test.ts tests/unit/review-ai-hint.test.ts tests/unit/diagnostic-rules.test.ts
```

Expected: FAIL because repositories still reference review items.

- [ ] **Step 3: Update review and diagnostic public types**

In `src/types/review.ts`, replace review item fields with question fields:

```ts
export type ReviewQueueItem = {
  questionId: string;
  knowledgeItemId: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  answer: QuestionAnswer;
  answerAliases: string[];
  explanation: string | null;
  difficulty: number;
  reviewReason: { label: string; detail: string };
  knowledgeItem: KnowledgeItemSummary & { body: string };
};

export type ReviewSubmitInput = {
  sessionId: string;
  questionId: string;
  knowledgeItemId: string;
  submittedAnswer: QuestionAnswer;
  responseTimeMs?: number;
  completed?: boolean;
};
```

Make the same `questionId` and `QuestionType` changes in `src/types/diagnostic.ts`.

- [ ] **Step 4: Update repositories**

Switch repository includes and counts from `reviewItems` to:

```ts
questionBindings: {
  where: {
    question: {
      isActive: true,
    },
  },
  include: {
    question: true,
  },
}
```

Expose `getActiveQuestionForKnowledgeItem({ questionId, knowledgeItemId, userId })` in `src/server/repositories/review-repository.ts`.

- [ ] **Step 5: Update review service**

In `submitReview`, grade the submitted answer, create a `QuestionAttempt`, map the grading result to a review grade, and update each bound `UserKnowledgeItemState`. For the initial implementation, keep `knowledgeItemId` in the request and guard that it is one of the question bindings.

- [ ] **Step 6: Update diagnostic service and rules**

Diagnostic start should list active questions. Diagnostic submit should accept question IDs and map incorrect/partial answers to weak knowledge items by bindings.

- [ ] **Step 7: Run focused service tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/review-item-active-filter.test.ts tests/unit/review-ai-hint.test.ts tests/unit/diagnostic-rules.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit services migration**

Run:

```bash
git add src/types/review.ts src/types/diagnostic.ts src/server/repositories src/server/services tests/unit/review-item-active-filter.test.ts tests/unit/review-ai-hint.test.ts tests/unit/diagnostic-rules.test.ts
git commit -m "refactor: drive review and diagnostics from questions"
```

## Task 5: Admin Import, Forms, And Seed Data

**Files:**
- Modify: `src/server/admin/admin-import-types.ts`
- Modify: `src/server/admin/admin-import-ai.ts`
- Modify: `src/server/admin/admin-import-validation.ts`
- Modify: `src/server/admin/admin-import-repository.ts`
- Modify: `src/server/admin/admin-knowledge-item-service.ts`
- Modify: `src/components/admin/knowledge-item-admin-form.tsx`
- Modify: `src/components/admin/admin-import-form.tsx`
- Modify: `src/server/admin/admin-bulk-generate-import-ai.ts`
- Modify: `src/server/admin/admin-bulk-generate-import-service.ts`
- Modify: `prisma/seed.ts`
- Modify: related unit tests under `tests/unit/admin-*`

- [ ] **Step 1: Write failing admin/import tests**

Update admin tests so they assert:

```ts
assert.doesNotMatch(form, /name="intuition"/);
assert.doesNotMatch(form, /name="deepDive"/);
assert.doesNotMatch(form, /name="useConditions"/);
assert.match(form, /name="formulaVariables"/);
assert.match(form, /name="questionBindings"/);
```

Update AI import tests so the schema has top-level `questions` and `questionBindings`, and no `reviewItems` or `variables` under item objects.

- [ ] **Step 2: Run admin/import tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-knowledge-item-form.test.ts tests/unit/admin-import-ai.test.ts tests/unit/admin-import-validation.test.ts tests/unit/admin-import-write-plan.test.ts
```

Expected: FAIL because old fields remain.

- [ ] **Step 3: Update import types and validation**

Change `AdminImportBatch` to:

```ts
export type AdminImportBatch = {
  sourceTitle?: string;
  defaultDomain?: string;
  items: AdminImportedKnowledgeItem[];
  questions: AdminImportedQuestion[];
  questionBindings: Array<{ questionSlug: string; knowledgeItemSlug: string }>;
  relations: AdminImportedRelation[];
};
```

`AdminImportedKnowledgeItem` should remove old global fields, `variables`, and `reviewItems`. Add `AdminImportedQuestion` using the normalized question shape plus a `slug` for import-time binding.

- [ ] **Step 4: Update admin forms**

Remove deleted knowledge fields from `KnowledgeItemAdminForm`. Replace review item textarea with a question binding textarea:

```text
question-slug | optional note
```

Use simplified payload builders for all six content types.

- [ ] **Step 5: Update import repository and bulk generation**

Save knowledge items first, save questions second, then create `QuestionKnowledgeItem` rows from binding slugs. Bulk generation should create one generated knowledge item and at least one bound generated question per row.

- [ ] **Step 6: Update seed data**

Rewrite seed knowledge item payloads to the simplified shapes and create at least one question of each type. Bind each seeded question to one or more seeded knowledge items.

- [ ] **Step 7: Run admin/import tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-knowledge-item-form.test.ts tests/unit/admin-import-ai.test.ts tests/unit/admin-import-validation.test.ts tests/unit/admin-import-write-plan.test.ts tests/unit/admin-bulk-generate-import-ai.test.ts tests/unit/admin-bulk-generate-import-service.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit admin/import migration**

Run:

```bash
git add src/server/admin src/components/admin prisma/seed.ts tests/unit/admin-*.test.ts
git commit -m "refactor: import and edit questions independently"
```

## Task 6: Practice UI And API

**Files:**
- Create: `src/components/question/question-card.tsx`
- Create: `src/app/practice/page.tsx`
- Create: `src/app/api/practice/questions/route.ts`
- Create: `src/app/api/practice/submit/route.ts`
- Modify: `src/components/knowledge-item/knowledge-item-detail-view.tsx`
- Modify: `src/app/page.tsx`
- Create or modify: `tests/unit/practice-ui.test.ts`
- Modify: `tests/e2e/critical-path.test.ts`

- [ ] **Step 1: Write failing practice UI/source tests**

Create `tests/unit/practice-ui.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("practice UI", () => {
  it("exposes standalone practice routes and shared question UI", () => {
    assert.match(readFileSync("src/app/practice/page.tsx", "utf8"), /QuestionCard/);
    assert.match(readFileSync("src/app/api/practice/questions/route.ts", "utf8"), /getPracticeQuestions/);
    assert.match(readFileSync("src/app/api/practice/submit/route.ts", "utf8"), /submitPracticeAnswer/);
  });

  it("shows knowledge-bound practice from knowledge item details", () => {
    assert.match(readFileSync("src/components/knowledge-item/knowledge-item-detail-view.tsx", "utf8"), /绑定题目|练习题|QuestionCard/);
  });
});
```

- [ ] **Step 2: Run practice tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/practice-ui.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement shared question card**

`QuestionCard` should render radio controls for `single_choice` and `true_false`, checkboxes for `multiple_choice`, an input for `fill_blank`, and a textarea for `short_answer`. It emits structured submitted answers matching `src/types/question.ts`.

- [ ] **Step 4: Implement practice APIs**

Add `getPracticeQuestions` and `submitPracticeAnswer` service helpers. The questions route filters by domain, subdomain, type, and difficulty. The submit route grades the answer and records a `QuestionAttempt`.

- [ ] **Step 5: Implement practice page and knowledge detail entry**

The standalone page should provide filters and a practice queue. Knowledge detail should show bound questions and a direct practice entry for the current knowledge item.

- [ ] **Step 6: Run practice tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/practice-ui.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit practice UI**

Run:

```bash
git add src/components/question src/app/practice src/app/api/practice src/components/knowledge-item/knowledge-item-detail-view.tsx src/app/page.tsx tests/unit/practice-ui.test.ts tests/e2e/critical-path.test.ts
git commit -m "feat: add question practice flow"
```

## Task 7: Full Verification And Cleanup

**Files:**
- Modify as needed from failing verification.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect old model references**

Run:

```bash
rg -n "ReviewItem|ReviewLog|reviewItems|reviewItemId|KnowledgeItemVariable|useConditions|nonUseConditions|antiPatterns|typicalProblems|deepDive|intuition" src prisma tests
```

Expected: no production references to removed models or removed knowledge fields. Test references are allowed only when asserting absence.

- [ ] **Step 5: Commit verification cleanup**

If any cleanup changes were needed, run:

```bash
git add .
git commit -m "chore: finish question simplification migration"
```

If no cleanup changes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: schema, simplified payloads, question validation, grading, scheduling mapping, review/diagnostic migration, admin import, seed data, practice entry points, and full verification each have tasks.
- No compatibility layer: the plan removes `ReviewItem`, `ReviewLog`, and `KnowledgeItemVariable` rather than keeping parallel models.
- Risk: Task 4 and Task 5 touch broad service surfaces. Run focused tests after each task and stop on repeated failures instead of piling changes across layers.

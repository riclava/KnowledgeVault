# Knowledge Items And Questions Simplification Design

## Goal

KnowledgeVault will keep the six existing knowledge item content types, but simplify the data model and editing experience so each type has a clear learning role and only a small set of type-specific fields. At the same time, practice questions become an independent module that supports richer question formats, automatic grading, and binding to one or more knowledge items.

This is development-stage work. Database shape changes should update the Prisma schema and development baseline directly. Do not add compatibility layers for the old `ReviewItem` model or removed knowledge item fields.

## Current Context

Knowledge items currently carry many global fields:

- `summary`
- `body`
- `intuition`
- `deepDive`
- `useConditions`
- `nonUseConditions`
- `antiPatterns`
- `typicalProblems`
- `examples`
- `tags`
- separate `KnowledgeItemVariable` records
- embedded `ReviewItem` records

This makes authoring slow because every type sees fields that only help some learning patterns. The newer structured content types also introduced heavier payloads, especially `comparison_table` and `procedure`.

The current practice model is `ReviewItem`, which is directly owned by a knowledge item and only supports `recall`, `recognition`, and `application`. That is too limited for a real practice flow with single choice, multiple choice, true/false, fill blank, and short answer questions.

## Chosen Approach

Use a clean split:

1. Knowledge items describe what to learn.
2. Questions describe how to practice.
3. A join table binds questions to one or more knowledge items.

Keep all six `KnowledgeItemType` values:

- `plain_text`
- `math_formula`
- `vocabulary`
- `concept_card`
- `comparison_table`
- `procedure`

Simplify the shared knowledge item fields to:

- `slug`
- `title`
- `contentType`
- `renderPayload`
- `domain`
- `subdomain`
- `summary`
- `body`
- `difficulty`
- `tags`
- `visibility`
- `createdByUserId`
- timestamps

Remove the global fields:

- `intuition`
- `deepDive`
- `useConditions`
- `nonUseConditions`
- `antiPatterns`
- `typicalProblems`
- `examples`

Remove `KnowledgeItemVariable`. Formula variables move into the `math_formula` payload because variables are type-specific learning content, not a global knowledge item concept.

Replace `ReviewItem` with `Question`. The old review, diagnostic, admin import, and scheduling flows will move to questions instead of preserving old naming or compatibility branches.

## Knowledge Item Payloads

### `plain_text`

Use for flexible notes, short explanations, or content that does not need a specialized structure.

```ts
type PlainTextRenderPayload = {
  text: string;
};
```

Validation:

- `text` is required and non-empty.

Rendering:

- Render readable paragraphs with preserved line breaks.

### `math_formula`

Use for formulas, equations, symbolic rules, and derivations where the formula itself is the memory anchor.

```ts
type MathFormulaRenderPayload = {
  latex: string;
  explanation: string;
  variables: Array<{
    symbol: string;
    name: string;
    meaning: string;
  }>;
};
```

Validation:

- `latex` is required and non-empty.
- `explanation` may be empty but should be present.
- Variables require `symbol` and `name`; `meaning` may normalize to an empty string.

Rendering:

- Show the formula prominently with KaTeX.
- Show explanation below it.
- Show variables as a compact symbol table when present.

### `vocabulary`

Use for terms, definitions, and usage examples.

```ts
type VocabularyRenderPayload = {
  term: string;
  definition: string;
  examples: string[];
};
```

Validation:

- `term` is required and non-empty.
- `definition` is required and non-empty.
- `examples` normalizes from arrays or newline-separated text.

Rendering:

- Show term and definition first.
- Show examples as short usage lines.

### `concept_card`

Use for conceptual knowledge that benefits from a definition, key points, and common mistakes.

```ts
type ConceptCardRenderPayload = {
  definition: string;
  keyPoints: string[];
  misconceptions: string[];
};
```

Validation:

- `definition` is required and non-empty.
- `keyPoints` and `misconceptions` normalize from arrays or newline-separated text.

Rendering:

- Show definition first.
- Show key points and misconceptions as distinct learning sections.

### `comparison_table`

Use for distinguishing similar or confusable ideas. It should have one learning-oriented matrix shape, not two table modes.

```ts
type ComparisonTableRenderPayload = {
  subjects: string[];
  aspects: Array<{
    label: string;
    values: string[];
  }>;
};
```

Validation:

- At least two `subjects` are required.
- At least one aspect is required.
- Each aspect requires a non-empty `label`.
- Aspect `values` normalize to the same length as `subjects`; missing values become empty strings and extra values are dropped.

Rendering:

- Render an accessible comparison table with aspects as rows and subjects as columns.

### `procedure`

Use for ordered operations, algorithms, workflows, and solving processes. It should focus on steps and pitfalls, not Mermaid graph editing.

```ts
type ProcedureRenderPayload = {
  steps: Array<{
    title: string;
    detail: string;
  }>;
  pitfalls: string[];
};
```

Validation:

- At least one step is required.
- Each step requires `title`; `detail` may normalize to an empty string.
- `pitfalls` normalize from arrays or newline-separated text.

Rendering:

- Render a numbered step sequence.
- Show pitfalls as a warning-oriented list when present.

## Question Module

Add first-class questions that can be used by practice, review, diagnostics, admin import, and bulk generation.

Question types:

- `single_choice`
- `multiple_choice`
- `true_false`
- `fill_blank`
- `short_answer`

Suggested Prisma shape:

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

  createdByUser User?                   @relation("QuestionCreator", fields: [createdByUserId], references: [id], onDelete: Cascade)
  knowledgeItems QuestionKnowledgeItem[]
  attempts       QuestionAttempt[]

  @@index([type])
  @@index([difficulty])
  @@index([visibility, createdByUserId])
  @@map("questions")
}

model QuestionKnowledgeItem {
  id              String   @id @default(cuid())
  questionId      String
  knowledgeItemId String
  createdAt       DateTime @default(now())

  question      Question      @relation(fields: [questionId], references: [id], onDelete: Cascade)
  knowledgeItem KnowledgeItem @relation(fields: [knowledgeItemId], references: [id], onDelete: Cascade)

  @@unique([questionId, knowledgeItemId])
  @@index([knowledgeItemId])
  @@map("question_knowledge_items")
}

model QuestionAttempt {
  id              String                @id @default(cuid())
  userId          String
  questionId      String
  studySessionId  String?
  submittedAnswer Json
  result          QuestionAttemptResult
  score           Float
  feedback        String?
  responseTimeMs  Int?
  reviewedAt      DateTime              @default(now())

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  question     Question      @relation(fields: [questionId], references: [id], onDelete: Cascade)
  studySession StudySession? @relation(fields: [studySessionId], references: [id], onDelete: SetNull)

  @@index([userId, reviewedAt])
  @@index([questionId])
  @@map("question_attempts")
}
```

The related existing models need matching relation fields:

- `User` adds `createdQuestions Question[] @relation("QuestionCreator")` and `questionAttempts QuestionAttempt[]`.
- `KnowledgeItem` replaces `reviewItems ReviewItem[]` with `questionBindings QuestionKnowledgeItem[]`.
- `StudySession` replaces `reviewLogs ReviewLog[]` with `questionAttempts QuestionAttempt[]`.

`ReviewItem` and `ReviewLog` should be removed. `Question` and `QuestionAttempt` replace them. Scheduling still updates `UserKnowledgeItemState`, because memory state is tracked per user and knowledge item. When a question is bound to multiple knowledge items, a submitted attempt updates each bound knowledge item state.

## Question Payload Rules

Use structured JSON for `options`, `answer`, and `submittedAnswer`:

- `single_choice`
  - `options`: `{ id: string; text: string }[]`
  - `answer`: `{ optionId: string }`
  - `submittedAnswer`: `{ optionId: string }`
- `multiple_choice`
  - `options`: `{ id: string; text: string }[]`
  - `answer`: `{ optionIds: string[] }`
  - `submittedAnswer`: `{ optionIds: string[] }`
- `true_false`
  - `options`: `null`
  - `answer`: `{ value: boolean }`
  - `submittedAnswer`: `{ value: boolean }`
- `fill_blank`
  - `options`: `null`
  - `answer`: `{ text: string }`
  - `answerAliases`: accepted alternative answers
  - `submittedAnswer`: `{ text: string }`
- `short_answer`
  - `options`: `null`
  - `answer`: `{ text: string }`
  - `submittedAnswer`: `{ text: string }`

Validation should reject unsupported shapes before persistence.

## Grading

The selected grading direction is automatic grading wherever possible.

Rule grading:

- `single_choice`: exact selected option id match.
- `multiple_choice`: selected option id set equals correct option id set.
- `true_false`: boolean match.
- `fill_blank`: normalize whitespace, punctuation, case, and full-width characters; accept `answer.text` or any `answerAliases`.

AI grading:

- `short_answer` uses the existing OpenAI-compatible AI layer.
- The grading prompt receives the question prompt, reference answer, explanation, and learner answer.
- The model must return strict JSON:

```ts
type AiShortAnswerGrade = {
  result: "correct" | "partial" | "incorrect";
  score: number;
  feedback: string;
};
```

Score bounds:

- `correct`: `0.8` to `1`
- `partial`: `0.4` to `<0.8`
- `incorrect`: `0` to `<0.4`

If AI grading fails, return a clear grading error and do not update scheduling state for that attempt.

## Scheduling Mapping

The existing spaced-review state remains knowledge-item based.

Question grading maps to review grades:

- `correct` with score `>= 0.95` maps to `easy`
- `correct` below `0.95` maps to `good`
- `partial` maps to `hard`
- `incorrect` maps to `again`

When a question is bound to multiple knowledge items, apply the same mapped review result to each bound knowledge item state. This keeps the question module independent while preserving the current knowledge-item learning model.

## Practice Entry Points

Initial implementation should support both entry points:

1. Knowledge item detail practice: practice questions bound to the current knowledge item.
2. Standalone practice page: filter and draw questions by domain, subdomain, type, difficulty, and active status.

Practice should show the appropriate answer UI per question type:

- Radio-style choices for single choice and true/false.
- Checkbox choices for multiple choice.
- Text input for fill blank.
- Textarea for short answer.

After submission, show result, score, feedback, correct answer, and explanation.

## Admin Editing And Import

Knowledge item admin forms should remove the deleted global fields and only show:

- basic fields
- simplified type-specific payload fields
- optional tags
- question binding summary or editor

Questions should have their own admin create/edit workflow. The question editor should support binding by knowledge item slug or search selection.

AI import should generate:

- simplified knowledge item payloads
- questions in the new `Question` format
- question-to-knowledge bindings

Bulk generation should support selecting the target knowledge item type and the desired question type mix. Generated rows should save both knowledge items and bound questions when validation succeeds.

## Rendering And Public UI

Knowledge item detail pages should use the simplified payload renderers. Removed fields should disappear from detail and remediation views.

Question rendering should be shared by:

- practice page
- review session
- diagnostic quiz
- knowledge item detail bound-question section

Question components should receive normalized question data and emit structured submitted answers.

## Data Reset And Seed

Because this is development-stage work:

- Update `prisma/schema.prisma`.
- Update `prisma/migrations/00000000000000_dev_baseline/migration.sql`.
- Regenerate the Prisma client.
- Update seeds to use simplified knowledge payloads and new questions.
- Reset local development data as needed.

## Tests

Add or update tests for:

- Prisma schema and baseline field shape.
- Knowledge item payload normalization for all six simplified payloads.
- Rejection of removed payload modes such as comparison `table` mode and procedure Mermaid nodes/edges.
- Knowledge item service summaries and details without removed global fields or variables.
- Question validation for all five question types.
- Rule grading for single choice, multiple choice, true/false, and fill blank.
- AI grading request and fallback behavior for short answer.
- Mapping question grading results to scheduling grades.
- Review and diagnostic services drawing from questions instead of review items.
- Admin knowledge item form simplified fields.
- Admin question editor and binding support.
- AI import schema producing simplified knowledge items and bound questions.
- Seed data containing at least one question of each type.

Expected verification commands:

```bash
npm run test
npm run lint
npm run build
```

## Out Of Scope

- Manual compatibility migration from old local data.
- Keeping `ReviewItem` as a parallel model.
- Drag-and-drop procedure editing.
- Mermaid procedure rendering.
- Multi-blank position-aware fill-in-the-blank rendering.
- Advanced adaptive question selection beyond existing scheduling rules.

## Success Criteria

- The knowledge item admin workflow is shorter and no longer exposes removed global fields.
- Each of the six content types has a distinct, lightweight payload and renderer.
- Questions are independently manageable and can bind to one or more knowledge items.
- Practice supports single choice, multiple choice, true/false, fill blank, and short answer.
- Objective question types are graded by rules.
- Short answer is graded by the existing OpenAI-compatible AI path.
- Review and diagnostic flows use questions and continue updating knowledge item memory state.
- The Prisma schema and development baseline match the new model without extra migrations.

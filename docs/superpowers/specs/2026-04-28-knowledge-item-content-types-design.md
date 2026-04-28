# Knowledge Item Content Types Design

## Goal

KnowledgeVault will add three first-class knowledge item content types:

- `concept_card`
- `comparison_table`
- `procedure`

The new types must work end to end: AI import, validation, persistence, admin editing, frontend rendering, review sessions, diagnostics, and text extraction. This is development-stage work, so database enum changes should update the Prisma schema and development baseline directly instead of creating a new migration.

## Current Context

The project currently supports `math_formula`, `vocabulary`, and `plain_text`. The content type appears in these main surfaces:

- Prisma `KnowledgeItemType` enum and the development baseline SQL.
- TypeScript knowledge item payload types.
- `normalizeKnowledgeItemRenderPayload` and `parseKnowledgeItemType`.
- Knowledge item renderer registry.
- Admin knowledge item form.
- Admin AI import JSON schema, mock generation, validation, and repository save path.
- Review, diagnostic, and knowledge detail views through the shared renderer.

The existing design is a good fit for extending through explicit payload types and renderer plugins.

## Chosen Approach

Use structured payloads with dedicated validation and renderers for each new type.

This avoids loose JSON that can fail late in the UI, while also avoiding a larger content-block rewrite. Existing content types remain as they are; the new types extend the same enum, payload, normalizer, renderer, and admin import patterns.

## Payloads

### `concept_card`

Use this for definitions, conceptual intuition, key points, examples, and common misunderstandings.

```ts
type ConceptCardRenderPayload = {
  definition: string;
  intuition: string;
  keyPoints: string[];
  examples: string[];
  misconceptions: string[];
};
```

Validation:

- `definition` is required and non-empty.
- `intuition` may normalize to an empty string.
- Arrays normalize from arrays or newline/comma-separated strings, matching existing helper behavior.
- Empty arrays are allowed.

Text extraction should prefer `definition`, then include intuition and list content.

### `comparison_table`

Use this for concept comparisons and general tables. It supports both a learning-oriented matrix mode and a generic table mode.

```ts
type ComparisonTableRenderPayload =
  | {
      mode: "matrix";
      subjects: string[];
      aspects: Array<{
        label: string;
        values: string[];
      }>;
    }
  | {
      mode: "table";
      columns: string[];
      rows: string[][];
    };
```

Validation:

- `mode` is required and must be `"matrix"` or `"table"`.
- Matrix mode requires at least two subjects and at least one aspect.
- Each matrix aspect requires a non-empty `label`.
- Matrix `values` should be normalized to the same length as `subjects`; missing values become empty strings and extra values are dropped.
- Table mode requires at least one column and one row.
- Each table row should be normalized to the same length as `columns`; missing values become empty strings and extra values are dropped.

AI import should prefer matrix mode for learning comparisons, but the schema must allow both modes.

Text extraction should flatten subjects, aspects, columns, and cell values.

### `procedure`

Use this for procedures, algorithms, decision flows, and solving workflows. First version supports complete read-only flowchart rendering with Mermaid, plus structured data for validation and future editing.

```ts
type ProcedureRenderPayload = {
  mode: "flowchart";
  title: string;
  overview: string;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    tips: string[];
    pitfalls: string[];
  }>;
  nodes: Array<{
    id: string;
    label: string;
    kind: "start" | "step" | "decision" | "end";
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string | null;
  }>;
  mermaid: string;
};
```

Validation:

- `mode` is required and must be `"flowchart"`.
- `title` and `mermaid` are required and non-empty.
- `overview` may normalize to an empty string.
- At least one step is required.
- Step `id`, `title`, and `description` are required.
- At least two nodes are required.
- Node `id` and `label` are required; `kind` must be one of `start`, `step`, `decision`, or `end`.
- Each edge must reference existing node ids.
- Edge labels normalize to `null` when blank.

Mermaid rendering is read-only in the first version. The admin backend stores both structured `steps/nodes/edges` and the generated Mermaid string. The admin UI edits this using structured text/JSON fields rather than a drag-and-drop editor.

Text extraction should include title, overview, step titles/descriptions, node labels, edge labels, and Mermaid text.

## Rendering

Add one renderer plugin per new type and register each in the shared renderer registry.

`concept_card` should render as compact learning sections: definition first, then intuition, key points, examples, and misconceptions. It should use existing semantic UI tokens and avoid introducing a new visual language.

`comparison_table` should render as an accessible HTML table. Matrix mode converts subjects into columns and aspects into rows. Table mode uses columns and rows directly.

`procedure` should render the overview and step list, then render Mermaid for the flowchart. Mermaid should be loaded in a client-side boundary so server rendering remains stable. If Mermaid fails, the UI should still show the structured steps and a readable fallback.

## Admin Editing

The admin knowledge item form should add the three new values to the content type selector.

First version editing should stay practical:

- `concept_card`: dedicated fields for definition, intuition, key points, examples, and misconceptions.
- `comparison_table`: mode selector plus structured textarea fields for matrix/table data.
- `procedure`: title, overview, steps textarea, nodes textarea, edges textarea, and Mermaid textarea.

The form should build render payloads in the same client-side submit path as current types. Validation remains server-side authoritative.

## AI Import

The AI import schema should include the three new content types in the enum and add payload definitions for each.

The schema should be strict and should continue to reject unsupported properties. The prompt and mock generator should model valid examples for the new types.

AI guidance:

- Use `concept_card` for conceptual explanations that benefit from structured definition and misconception fields.
- Use `comparison_table` when the source material distinguishes related or confusable ideas. Prefer `mode: "matrix"` unless the source is already tabular.
- Use `procedure` when the source material describes ordered operations, algorithms, decision flows, or solving processes. Include a Mermaid flowchart matching the structured nodes and edges.

Validation after AI generation remains mandatory before saving.

## Database

Update:

- `prisma/schema.prisma`
- `prisma/migrations/00000000000000_dev_baseline/migration.sql`

Do not add a new migration for this development-stage enum change.

After schema updates, regenerate the Prisma client and push/reset the development database as needed during implementation.

## Tests

Add or update tests for:

- Payload normalization for all three new types.
- Invalid payload rejection for required fields and malformed table/flow references.
- `parseKnowledgeItemType` accepting the new enum values.
- Renderer registry coverage for every `KnowledgeItemType`.
- Admin form content type selector and payload field support.
- Admin AI schema enum and payload definitions.
- Mock AI import generating at least one valid item using a new type.
- Baseline schema containing the new enum values.

Existing test commands should remain:

- `npm run test`
- `npm run lint`
- `npm run build`

## Out of Scope

- Drag-and-drop flowchart editing.
- Uploading images or drawing custom diagrams.
- Migrating existing `plain_text` records into `concept_card`.
- Replacing the current content type model with a generic block system.
- Adding new review item types.

## Success Criteria

- Admin users can create and edit all three new content types.
- AI import can generate, validate, and save all three new content types.
- Learners can view the new types anywhere existing knowledge item renderers are used.
- Review and diagnostic flows continue to work without type-specific branching outside the shared renderer and payload utilities.
- Invalid AI/admin payloads fail validation before persistence.

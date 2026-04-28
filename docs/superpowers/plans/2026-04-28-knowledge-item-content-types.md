# Knowledge Item Content Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class `concept_card`, `comparison_table`, and `procedure` knowledge item content types across validation, rendering, admin editing, AI import, and database schema.

**Architecture:** Extend the current enum-plus-payload model rather than introducing a generic block system. Each new type gets a typed payload, normalizer branch, renderer plugin, admin form branch, and AI schema definition. `procedure` uses Mermaid for read-only flowchart rendering while keeping structured steps, nodes, and edges for validation and future editing.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/Postgres, Node test runner, Mermaid.

---

## File Structure

- Modify `prisma/schema.prisma` and `prisma/migrations/00000000000000_dev_baseline/migration.sql` to add enum values directly.
- Modify `src/types/knowledge-item.ts` to add payload types and union members.
- Modify `src/lib/knowledge-item-render-payload.ts` to parse and normalize the new payloads.
- Create renderer files under `src/components/knowledge-item/renderers/` for `concept_card`, `comparison_table`, `procedure`, and a client-side Mermaid component.
- Modify `src/components/knowledge-item/renderers/registry.ts` to register all new renderers.
- Modify `src/components/admin/knowledge-item-admin-form.tsx` to add admin editing fields and payload builders.
- Modify `src/server/admin/admin-import-ai.ts` to update strict AI schema and mock data.
- Modify `src/server/admin/admin-knowledge-item-service.ts` and any local content type constants to include the new values.
- Update tests in `tests/unit/knowledge-item-render-payload.test.ts`, `tests/unit/admin-import-ai.test.ts`, `tests/unit/admin-schema-shape.test.ts`, and `tests/unit/admin-knowledge-item-form.test.ts`.
- Add a renderer registry/source test if needed to lock full renderer coverage.

## Task 1: Schema And Payload Normalization

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/00000000000000_dev_baseline/migration.sql`
- Modify: `src/types/knowledge-item.ts`
- Modify: `src/lib/knowledge-item-render-payload.ts`
- Modify: `tests/unit/knowledge-item-render-payload.test.ts`
- Modify: `tests/unit/admin-schema-shape.test.ts`

- [ ] **Step 1: Write failing payload tests**

Add tests that call `normalizeKnowledgeItemRenderPayload` for:

```ts
normalizeKnowledgeItemRenderPayload("concept_card", {
  definition: "A limit describes the value approached by a function.",
  intuition: "It is about getting close, not necessarily arriving.",
  keyPoints: "approach\nneighborhood",
  examples: ["lim x->0 sin(x)/x = 1"],
  misconceptions: ["The function must be defined at the point."],
});

normalizeKnowledgeItemRenderPayload("comparison_table", {
  mode: "matrix",
  subjects: ["Bayes", "Total probability"],
  aspects: [{ label: "Use", values: ["Reverse conditional", "Marginalize cases"] }],
});

normalizeKnowledgeItemRenderPayload("comparison_table", {
  mode: "table",
  columns: ["Step", "Action"],
  rows: [["1", "Read"], ["2"]],
});

normalizeKnowledgeItemRenderPayload("procedure", {
  mode: "flowchart",
  title: "Solve linear equation",
  overview: "Isolate the unknown.",
  steps: [{ id: "isolate", title: "Isolate", description: "Move constants away.", tips: ["Keep balance"], pitfalls: ["Forgetting signs"] }],
  nodes: [{ id: "start", label: "Start", kind: "start" }, { id: "isolate", label: "Isolate x", kind: "step" }],
  edges: [{ from: "start", to: "isolate", label: "" }],
  mermaid: "flowchart TD\n  start([Start]) --> isolate[Isolate x]",
});
```

Also assert invalid cases throw: blank concept definition, matrix with one subject, table with no rows, and procedure edge referencing a missing node.

- [ ] **Step 2: Write failing schema enum test**

Extend `admin-schema-shape.test.ts` so `KnowledgeItemType` in both Prisma schema and baseline contains `concept_card`, `comparison_table`, and `procedure`.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/knowledge-item-render-payload.test.ts tests/unit/admin-schema-shape.test.ts
```

Expected: FAIL because the new content type strings are not assignable/accepted and enum values are missing.

- [ ] **Step 4: Implement minimal schema and normalizer support**

Add the enum values to Prisma and baseline. Add TypeScript payload types, extend `KnowledgeItemType`, add helper functions for table rows and procedure references, and add branches to `normalizeKnowledgeItemRenderPayload` and `knowledgeItemRenderPayloadToText`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/knowledge-item-render-payload.test.ts tests/unit/admin-schema-shape.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/00000000000000_dev_baseline/migration.sql src/types/knowledge-item.ts src/lib/knowledge-item-render-payload.ts tests/unit/knowledge-item-render-payload.test.ts tests/unit/admin-schema-shape.test.ts
git commit -m "feat: add structured knowledge item payload types"
```

## Task 2: Renderer Plugins And Mermaid Rendering

**Files:**
- Create: `src/components/knowledge-item/renderers/concept-card-renderer.tsx`
- Create: `src/components/knowledge-item/renderers/comparison-table-renderer.tsx`
- Create: `src/components/knowledge-item/renderers/procedure-renderer.tsx`
- Create: `src/components/knowledge-item/renderers/mermaid-diagram.tsx`
- Modify: `src/components/knowledge-item/renderers/registry.ts`
- Modify: `tests/unit/knowledge-item-render-payload.test.ts` or create `tests/unit/knowledge-item-renderer-registry.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing renderer registry test**

Add a source test asserting `registry.ts` imports/registers `concept_card`, `comparison_table`, and `procedure`, and `package.json` includes `mermaid`.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/knowledge-item-renderer-registry.test.ts
```

Expected: FAIL because the renderer files and registry keys do not exist.

- [ ] **Step 3: Install Mermaid**

Run:

```bash
npm install mermaid
```

- [ ] **Step 4: Implement renderers**

Create the three renderer plugins. Use existing bordered, semantic UI styling. The Mermaid component should be a client component that dynamically imports `mermaid`, renders into a ref, and falls back to a `<pre>` if rendering fails.

- [ ] **Step 5: Run focused tests and build typing**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/knowledge-item-renderer-registry.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/knowledge-item/renderers tests/unit/knowledge-item-renderer-registry.test.ts
git commit -m "feat: render structured knowledge item types"
```

## Task 3: Admin Editing Support

**Files:**
- Modify: `src/components/admin/knowledge-item-admin-form.tsx`
- Modify: `tests/unit/admin-knowledge-item-form.test.ts`

- [ ] **Step 1: Write failing admin form tests**

Extend the form test to assert:

- `CONTENT_TYPES` includes `concept_card`, `comparison_table`, `procedure`.
- The form has labels for `definition`, `comparisonMode`, `matrixSubjects`, `tableColumns`, `procedureSteps`, `procedureNodes`, `procedureEdges`, and `mermaid`.
- `buildRenderPayload` has explicit branches for all three new content types.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-knowledge-item-form.test.ts
```

Expected: FAIL because the form does not expose the new fields.

- [ ] **Step 3: Implement admin fields and builders**

Add content type options and render payload field branches. Use dedicated fields for concept cards. Use mode plus textarea fields for comparison tables. Use title/overview/steps/nodes/edges/Mermaid fields for procedures. Add parsing and formatting helpers for structured textarea values.

- [ ] **Step 4: Run test and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-knowledge-item-form.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/knowledge-item-admin-form.tsx tests/unit/admin-knowledge-item-form.test.ts
git commit -m "feat: edit structured content types in admin"
```

## Task 4: AI Import Support

**Files:**
- Modify: `src/server/admin/admin-import-ai.ts`
- Modify: `src/server/admin/admin-knowledge-item-service.ts`
- Modify: `tests/unit/admin-import-ai.test.ts`
- Modify: `tests/unit/admin-import-validation.test.ts`
- Modify: `tests/unit/admin-knowledge-item-service.test.ts` if content type filters are locked there

- [ ] **Step 1: Write failing AI schema and validation tests**

Extend tests to assert the AI schema content type enum includes all six content types, `$defs` contains `conceptCardPayload`, `comparisonTablePayload`, and `procedurePayload`, and mock generation returns at least one item using a new content type.

Add validation examples that a valid generated batch can include all three new payloads and that malformed procedure edges are rejected.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-import-ai.test.ts tests/unit/admin-import-validation.test.ts
```

Expected: FAIL because the schema and mock do not include the new payload definitions.

- [ ] **Step 3: Implement AI schema, mock data, and filters**

Update the strict JSON schema with the new enum values and payload `$defs`. Update `renderPayload.anyOf`. Update mock data to generate valid examples. Update admin content type filters/constants to accept the new values.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
TMPDIR=/tmp npx tsx --test tests/unit/admin-import-ai.test.ts tests/unit/admin-import-validation.test.ts tests/unit/admin-knowledge-item-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/admin-import-ai.ts src/server/admin/admin-knowledge-item-service.ts tests/unit/admin-import-ai.test.ts tests/unit/admin-import-validation.test.ts tests/unit/admin-knowledge-item-service.test.ts
git commit -m "feat: support structured types in AI import"
```

## Task 5: Full Verification

**Files:**
- Any files modified by prior tasks

- [ ] **Step 1: Regenerate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: command exits 0.

- [ ] **Step 2: Push development schema**

Run:

```bash
npm run db:push
```

Expected: command exits 0.

- [ ] **Step 3: Run all verification**

Run:

```bash
npm run test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Final commit if verification fixes were needed**

If verification required fixes, commit those exact fixes with:

```bash
git add <fixed-files>
git commit -m "fix: stabilize structured content type support"
```

- [ ] **Step 5: Report completion**

Report changed surfaces, verification output, and any residual risk.

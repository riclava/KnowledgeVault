# Knowledge Items Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the formula-only product model with generic knowledge items that support math formulas, vocabulary, and plain text through renderer plugins.

**Architecture:** Use a single `KnowledgeItem` aggregate with `contentType` and `renderPayload`, then keep review, diagnostic, stats, relations, and memory hooks generic. Static renderer plugins handle type-specific display only.

**Tech Stack:** Next.js App Router, TypeScript, React, Prisma, PostgreSQL, KaTeX, Node test runner.

---

## File Structure

- Create `src/types/knowledge-item.ts`: public knowledge item contracts and render payload types.
- Create `src/lib/knowledge-item-render-payload.ts`: validation and normalization helpers for item payloads.
- Create `src/components/knowledge-item/renderers/*`: renderer plugin registry and initial renderers.
- Rename `src/server/repositories/formula-repository.ts` to `src/server/repositories/knowledge-item-repository.ts`.
- Rename `src/server/services/formula-service.ts` to `src/server/services/knowledge-item-service.ts`.
- Rename `src/server/services/formula-draft-service.ts` to `src/server/services/knowledge-item-draft-service.ts`.
- Rename `src/components/formula/*` to `src/components/knowledge-item/*`.
- Rename `/src/app/formulas` to `/src/app/knowledge-items`.
- Rename `/src/app/api/formulas` to `/src/app/api/knowledge-items`.
- Modify `prisma/schema.prisma` and `prisma/migrations/00000000000000_dev_baseline/migration.sql` directly.
- Modify `prisma/seed.ts` to seed mixed knowledge item types.
- Modify review, diagnostic, stats, memory hook, derivation, path, content-assist, summary pages and tests to use knowledge item naming.

## Task 1: Render Payload Contracts and Renderer Plugins

**Files:**
- Create: `src/types/knowledge-item.ts`
- Create: `src/lib/knowledge-item-render-payload.ts`
- Create: `src/components/knowledge-item/renderers/types.ts`
- Create: `src/components/knowledge-item/renderers/math-formula-renderer.tsx`
- Create: `src/components/knowledge-item/renderers/vocabulary-renderer.tsx`
- Create: `src/components/knowledge-item/renderers/plain-text-renderer.tsx`
- Create: `src/components/knowledge-item/renderers/registry.ts`
- Create: `src/components/knowledge-item/renderers/knowledge-item-renderer.tsx`
- Create: `tests/unit/knowledge-item-render-payload.test.ts`

- [ ] **Step 1: Write failing payload validation tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeKnowledgeItemRenderPayload,
  parseKnowledgeItemType,
} from "@/lib/knowledge-item-render-payload";

describe("knowledge item render payloads", () => {
  it("normalizes math formula payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("math_formula", { latex: "x^2" }),
      { latex: "x^2" },
    );
  });

  it("normalizes vocabulary payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("vocabulary", {
        term: "aberration",
        definition: "a departure from what is normal",
        phonetic: " /ˌæbəˈreɪʃn/ ",
        examples: ["A short spike was an aberration."],
      }),
      {
        term: "aberration",
        definition: "a departure from what is normal",
        phonetic: "/ˌæbəˈreɪʃn/",
        partOfSpeech: "",
        examples: ["A short spike was an aberration."],
      },
    );
  });

  it("rejects invalid payloads", () => {
    assert.throws(
      () => normalizeKnowledgeItemRenderPayload("plain_text", { text: "" }),
      /plain text/i,
    );
    assert.equal(parseKnowledgeItemType("formula"), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/knowledge-item-render-payload.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement payload types and renderer plugins**

Add discriminated payload types, runtime validation, static renderer registry, and a wrapper component that can render inline or block display.

- [ ] **Step 4: Run unit test**

Run: `npm run test -- tests/unit/knowledge-item-render-payload.test.ts`

Expected: PASS.

## Task 2: Prisma Schema and Baseline Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/00000000000000_dev_baseline/migration.sql`

- [ ] **Step 1: Convert Prisma schema**

Rename formula models, relations, fields, enums, indexes, and mapped table names to knowledge item terminology. Add `KnowledgeItemType`, `contentType`, `renderPayload`, `summary`, `body`, and `extension`.

- [ ] **Step 2: Convert baseline SQL**

Update the development baseline migration directly. Create `KnowledgeItemType`, rename table definitions to `knowledge_items`, and update all foreign keys, indexes, and enum names so a fresh database creates only the new model.

- [ ] **Step 3: Generate Prisma client**

Run: `npm run prisma:generate`

Expected: Prisma client generation succeeds.

## Task 3: Repository and Service Rename

**Files:**
- Rename/modify: `src/server/repositories/knowledge-item-repository.ts`
- Rename/modify: `src/server/services/knowledge-item-service.ts`
- Rename/modify: `src/server/services/knowledge-item-draft-service.ts`
- Modify: all imports that reference formula repository/service/draft service.

- [ ] **Step 1: Write failing creation test**

Add a focused unit test for payload normalization in custom item creation if repository integration is too database-heavy for unit tests. The service must require `contentType`, normalize `renderPayload`, and create type-appropriate default review items.

- [ ] **Step 2: Rename modules and update service contracts**

Move formula modules to knowledge item names. Rename exported functions and DTO fields from formula terminology to knowledge item terminology. Replace `expressionLatex` with `renderPayload` and `summary`.

- [ ] **Step 3: Run unit tests**

Run: `npm run test`

Expected: TypeScript test runner passes or exposes the next set of compile/runtime naming errors.

## Task 4: API and App Routes

**Files:**
- Rename/modify: `src/app/formulas/**` -> `src/app/knowledge-items/**`
- Rename/modify: `src/app/api/formulas/**` -> `src/app/api/knowledge-items/**`
- Modify: navigation links throughout `src/app` and `src/components`.

- [ ] **Step 1: Move route directories**

Use filesystem moves for route directories so old `/formulas` paths disappear.

- [ ] **Step 2: Update route handlers**

Rename request fields and response payloads to `knowledgeItemId`, `contentType`, `renderPayload`, and `summary`. Keep no legacy API aliases.

- [ ] **Step 3: Update links**

Update every app link from `/formulas` to `/knowledge-items` and every API call from `/api/formulas` to `/api/knowledge-items`.

## Task 5: Components and UI Copy

**Files:**
- Rename/modify: `src/components/knowledge-item/*`
- Modify: `src/components/app/phase-shell.tsx`
- Modify: `src/components/app/phase-tools-menu.tsx`
- Modify: summary, paths, review, diagnostic, derivation, memory hook, and content-assist components.

- [ ] **Step 1: Replace formula render calls**

Use `KnowledgeItemRenderer` instead of direct `LatexRenderer` usage for knowledge item display.

- [ ] **Step 2: Generalize detail and catalog views**

Rename detail/list/custom form components. Hide variables and derivation when empty or irrelevant. Replace user-facing "公式" copy with "知识项" except where the selected type is explicitly math formula.

- [ ] **Step 3: Add type-specific authoring fields**

The custom form must collect math formula, vocabulary, and plain text payloads and submit one generic knowledge item payload.

## Task 6: Review, Diagnostic, Stats, and Tests

**Files:**
- Modify: `src/types/review.ts`
- Modify: `src/types/diagnostic.ts`
- Modify: `src/types/stats.ts`
- Modify: `src/server/services/review-service.ts`
- Modify: `src/server/repositories/review-repository.ts`
- Modify: `src/server/services/diagnostic-service.ts`
- Modify: `src/server/repositories/diagnostic-repository.ts`
- Modify: `src/server/services/stats-service.ts`
- Modify: `src/server/repositories/stats-repository.ts`
- Modify: `tests/unit/*.test.ts`
- Modify: `tests/e2e/critical-path.test.ts`

- [ ] **Step 1: Rename domain fields**

Change formula IDs and weak formula naming to knowledge item IDs and weak item naming in types, services, repositories, and tests.

- [ ] **Step 2: Preserve scheduling behavior**

Keep review selection and scheduling logic behaviorally equivalent, but ensure queue items carry the full knowledge item summary and render payload.

- [ ] **Step 3: Update e2e critical path**

Replace formula creation with knowledge item creation and add a vocabulary item case that proves non-formula content enters the learning flow.

## Task 7: Seed Data and Content Assist

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `src/types/content-assist.ts`
- Modify: `src/server/services/content-assist-service.ts`
- Modify: `src/components/content-assist/*`
- Modify: `src/app/content-assist/**`

- [ ] **Step 1: Convert existing seed formulas**

Convert math formula seed entries to knowledge items with `contentType: "math_formula"` and `renderPayload: { latex }`.

- [ ] **Step 2: Add non-formula seed items**

Add at least one vocabulary item and one plain text item in real domains to prove mixed-type support.

- [ ] **Step 3: Generalize content assist naming**

Update drafts and editor UI to knowledge item naming, preserving the internal workflow.

## Task 8: Full Verification

**Files:**
- All touched files.

- [ ] **Step 1: Search for forbidden legacy surfaces**

Run: `rg -n "expressionLatex|FormulaSummary|FormulaDetail|/formulas|/api/formulas|formulaId|weakFormula|FormulaRelation|FormulaMemoryHook|UserFormulaState" src tests prisma`

Expected: No active source references except intentional historical docs or dependency names.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run unit tests**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 4: Run e2e tests**

Run: `npm run test:e2e`

Expected: PASS, or report database/service prerequisite if the environment is not running.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: PASS.

## Self-Review

- The plan covers the spec requirements: data model, renderer plugins, routes/API, server modules, authoring/import, seed data, UI copy, and verification.
- There are no placeholder steps that defer design decisions.
- Type names consistently use `KnowledgeItem` and `knowledgeItemId`.
- The plan intentionally performs a breaking rename with no compatibility layer, matching the project instructions.

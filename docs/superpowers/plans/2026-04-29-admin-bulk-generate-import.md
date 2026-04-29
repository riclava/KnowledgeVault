# Admin Bulk Generate Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated admin batch generation import workflow with backend-owned progress, row-level durable status, and real-time polling UI.

**Architecture:** Add Prisma baseline models for bulk import runs and rows, then implement a focused admin bulk import service that creates runs, processes rows, and exposes run progress. The UI creates a run from an uploaded text file, starts backend processing, and polls persisted run details until the run reaches a terminal status.

**Tech Stack:** Next.js App Router, React client components, Prisma/Postgres, Node test runner through `tsx --test`, existing OpenAI-compatible admin import helpers, existing admin auth helpers.

---

### Task 1: Schema And Baseline

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/00000000000000_dev_baseline/migration.sql`
- Test: `tests/unit/admin-schema-shape.test.ts`

- [ ] **Step 1: Write the failing schema test**

Add assertions that `AdminBulkGenerateImportRunStatus`, `AdminBulkGenerateImportRowStatus`, `AdminBulkGenerateImportRun`, `AdminBulkGenerateImportRow`, and matching baseline SQL exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/admin-schema-shape.test.ts`

Expected: FAIL because the new enums and models are missing.

- [ ] **Step 3: Add schema and baseline SQL**

Add the two enums and two models from the approved design. Add matching SQL types, tables, indexes, unique constraint, and foreign keys to the baseline migration.

- [ ] **Step 4: Generate Prisma client**

Run: `npm run prisma:generate`

Expected: generated Prisma client includes the new enums and model delegates.

- [ ] **Step 5: Run schema test**

Run: `npm test -- tests/unit/admin-schema-shape.test.ts`

Expected: PASS.

### Task 2: Bulk Import Types, AI Helper, And Service

**Files:**
- Create: `src/server/admin/admin-bulk-generate-import-types.ts`
- Create: `src/server/admin/admin-bulk-generate-import-ai.ts`
- Create: `src/server/admin/admin-bulk-generate-import-repository.ts`
- Create: `src/server/admin/admin-bulk-generate-import-service.ts`
- Modify: `src/server/admin/admin-import-ai.ts`
- Test: `tests/unit/admin-bulk-generate-import-service.test.ts`
- Test: `tests/unit/admin-bulk-generate-import-ai.test.ts`

- [ ] **Step 1: Write failing normalization and counting tests**

Test that request normalization trims lines, preserves original line numbers, rejects missing domain and invalid content type, and caps the batch at 10000 non-empty rows.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/admin-bulk-generate-import-service.test.ts`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement request normalization and result counting**

Add focused pure functions for request normalization, row status classification, and summary counting.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/admin-bulk-generate-import-service.test.ts`

Expected: PASS for pure service tests.

- [ ] **Step 5: Write failing AI helper tests**

Test that the one-line AI helper forces the selected content type, domain, subdomain, exactly one item, and no relations in both prompt and mock output.

- [ ] **Step 6: Run AI tests to verify they fail**

Run: `npm test -- tests/unit/admin-bulk-generate-import-ai.test.ts`

Expected: FAIL because the AI helper does not exist.

- [ ] **Step 7: Implement AI helper**

Reuse the existing admin import schema and provider selection, but add a one-line generation prompt and deterministic mock one-item batch.

- [ ] **Step 8: Run AI tests**

Run: `npm test -- tests/unit/admin-bulk-generate-import-ai.test.ts`

Expected: PASS.

### Task 3: Persistence And Processing

**Files:**
- Modify: `src/server/admin/admin-bulk-generate-import-repository.ts`
- Modify: `src/server/admin/admin-bulk-generate-import-service.ts`
- Test: `tests/unit/admin-bulk-generate-import-service.test.ts`

- [ ] **Step 1: Write failing repository/service tests with fakes**

Test run creation produces one row per line, processing marks rows through terminal statuses, validation failure on one row does not stop another row, duplicate warnings skip saving, and summary counts match row statuses.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/admin-bulk-generate-import-service.test.ts`

Expected: FAIL because persistence and processing orchestration are missing.

- [ ] **Step 3: Implement repository methods**

Add create run, get run detail, mark run running/completed/failed, list pending rows, mark row processing/imported/duplicate/failed, and recompute run counts.

- [ ] **Step 4: Implement processor**

Process pending rows in line order using injected dependencies for tests and real dependencies for production.

- [ ] **Step 5: Run service tests**

Run: `npm test -- tests/unit/admin-bulk-generate-import-service.test.ts`

Expected: PASS.

### Task 4: API Routes

**Files:**
- Create: `src/app/api/admin/bulk-generate-import/runs/route.ts`
- Create: `src/app/api/admin/bulk-generate-import/runs/[id]/route.ts`
- Create: `src/app/api/admin/bulk-generate-import/runs/[id]/process/route.ts`
- Test: `tests/unit/admin-ui-copy.test.ts`

- [ ] **Step 1: Write failing route shape tests**

Add copy/static tests confirming the routes use `withAdminApi`, create/read/process service calls, and process returns 202 semantics.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/admin-ui-copy.test.ts`

Expected: FAIL because route files are missing.

- [ ] **Step 3: Implement routes**

Add create, read, and process endpoints. The process endpoint starts backend processing and returns quickly.

- [ ] **Step 4: Run route tests**

Run: `npm test -- tests/unit/admin-ui-copy.test.ts`

Expected: PASS.

### Task 5: Admin UI

**Files:**
- Create: `src/components/admin/admin-bulk-generate-import-form.tsx`
- Create: `src/app/admin/bulk-generate-import/page.tsx`
- Modify: `src/app/admin/layout.tsx`
- Test: `tests/unit/admin-ui-copy.test.ts`

- [ ] **Step 1: Write failing UI tests**

Assert the admin navigation exposes `批量生成导入`, the page loads domain options, and the form contains content type, domain, subdomain, file upload, progress, polling, and row result copy.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/admin-ui-copy.test.ts`

Expected: FAIL because UI files are missing.

- [ ] **Step 3: Implement UI**

Build the upload form, create-run request, process-start request, polling loop, progress metrics, and row-level result table using existing UI primitives.

- [ ] **Step 4: Run UI tests**

Run: `npm test -- tests/unit/admin-ui-copy.test.ts`

Expected: PASS.

### Task 6: Verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/unit/admin-schema-shape.test.ts tests/unit/admin-bulk-generate-import-service.test.ts tests/unit/admin-bulk-generate-import-ai.test.ts tests/unit/admin-ui-copy.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

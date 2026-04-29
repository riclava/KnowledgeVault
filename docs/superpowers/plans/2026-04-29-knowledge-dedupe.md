# Knowledge Dedupe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only manual dedupe workflow for public knowledge items, including scan runs, candidate review, and transactional merge with learning-history migration.

**Architecture:** Add deterministic local similarity scoring, persist scan runs/candidates, expose admin APIs, and add a simple `/admin/dedupe` page. Merge logic lives in a focused transaction service that validates public candidate items before redirecting dependent records and deleting duplicates.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7, PostgreSQL, Node test runner, existing OpenAI-compatible AI helper.

---

## File Structure

- Create `src/server/admin/knowledge-dedupe-similarity.ts`: pure text normalization, pair scoring, and connected-component clustering.
- Create `src/server/admin/admin-knowledge-dedupe-repository.ts`: Prisma persistence for dedupe runs and candidates.
- Create `src/server/admin/admin-knowledge-dedupe-scan-service.ts`: domain scan orchestration and optional AI candidate review.
- Create `src/server/admin/admin-knowledge-dedupe-merge-service.ts`: transactional merge and dependent-data migration.
- Create `src/components/admin/knowledge-dedupe-panel.tsx`: client-side scan, ignore, and merge controls.
- Create `src/app/admin/dedupe/page.tsx`: server page loading domains and recent runs.
- Create API routes under `src/app/api/admin/dedupe`.
- Modify `prisma/schema.prisma` and `prisma/migrations/00000000000000_dev_baseline/migration.sql`: add dedupe enums/models directly to baseline.
- Modify `src/app/admin/layout.tsx` and `src/app/admin/page.tsx`: add dedupe navigation/entry point.
- Add tests:
  - `tests/unit/knowledge-dedupe-similarity.test.ts`
  - `tests/unit/admin-knowledge-dedupe-scan-service.test.ts`
  - `tests/unit/admin-knowledge-dedupe-merge-service.test.ts`

## Task 1: Similarity Scoring

**Files:**
- Create: `src/server/admin/knowledge-dedupe-similarity.ts`
- Test: `tests/unit/knowledge-dedupe-similarity.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests that assert:

```ts
scoreKnowledgeDedupePair(algebraA, algebraB).score >= 0.6;
scoreKnowledgeDedupePair(algebraA, unrelatedGeometry).score < 0.35;
clusterKnowledgeDedupePairs([
  { itemIds: ["a", "b"], score: 0.8, reasons: [] },
  { itemIds: ["b", "c"], score: 0.7, reasons: [] },
]).map((group) => group.itemIds)
```

returns one `["a", "b", "c"]` group.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/unit/knowledge-dedupe-similarity.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure functions**

Export:

```ts
export type KnowledgeDedupeScoredItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  contentType: string;
  tags: string[];
  useConditions: string[];
  typicalProblems: string[];
  examples: string[];
};

export type KnowledgeDedupePair = {
  itemIds: [string, string];
  score: number;
  reasons: Array<{ kind: string; score: number; detail: string }>;
};

export function scoreKnowledgeDedupePair(
  first: KnowledgeDedupeScoredItem,
  second: KnowledgeDedupeScoredItem,
): KnowledgeDedupePair;

export function findKnowledgeDedupePairs(
  items: KnowledgeDedupeScoredItem[],
  threshold: number,
): KnowledgeDedupePair[];

export function clusterKnowledgeDedupePairs(
  pairs: KnowledgeDedupePair[],
): Array<{ itemIds: string[]; score: number; reasons: KnowledgeDedupePair["reasons"] }>;
```

Use normalized lowercase text, token sets, Dice/Jaccard overlap, and weighted scoring for title, slug, summary/body, tags/conditions/examples, and content type.

- [ ] **Step 4: Run tests and verify pass**

Run: `npm test -- tests/unit/knowledge-dedupe-similarity.test.ts`

Expected: PASS.

## Task 2: Schema and Baseline

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/00000000000000_dev_baseline/migration.sql`

- [ ] **Step 1: Add failing schema-shape tests**

Extend `tests/unit/admin-schema-shape.test.ts` to assert the Prisma schema includes:

```ts
enum KnowledgeDedupeRunStatus
enum KnowledgeDedupeCandidateStatus
model KnowledgeDedupeRun
model KnowledgeDedupeCandidate
@@map("knowledge_dedupe_runs")
@@map("knowledge_dedupe_candidates")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/unit/admin-schema-shape.test.ts`

Expected: FAIL until schema text is updated.

- [ ] **Step 3: Update Prisma schema and baseline SQL**

Add the enums and models from the approved spec. Add `knowledgeDedupeRuns KnowledgeDedupeRun[]` to `User`.

In baseline SQL, add enum creation, create both tables, add indexes, and add the foreign key from dedupe run to `users`.

- [ ] **Step 4: Generate Prisma client**

Run: `npm run prisma:generate`

Expected: command exits 0.

- [ ] **Step 5: Run schema tests**

Run: `npm test -- tests/unit/admin-schema-shape.test.ts`

Expected: PASS.

## Task 3: Repository and Scan Service

**Files:**
- Create: `src/server/admin/admin-knowledge-dedupe-repository.ts`
- Create: `src/server/admin/admin-knowledge-dedupe-scan-service.ts`
- Test: `tests/unit/admin-knowledge-dedupe-scan-service.test.ts`

- [ ] **Step 1: Write failing scan tests**

Mock `prisma.knowledgeItem.findMany`, `prisma.knowledgeDedupeRun.create`, and `prisma.knowledgeDedupeCandidate.createMany`. Assert scan queries only use:

```ts
where: { visibility: "public", domain: "数学", subdomain: "代数" }
```

Assert a scan with two duplicate items returns a completed run with candidate count `1`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/unit/admin-knowledge-dedupe-scan-service.test.ts`

Expected: FAIL because service files do not exist.

- [ ] **Step 3: Implement repository**

Export functions:

```ts
createKnowledgeDedupeRun(input)
completeKnowledgeDedupeRun(input)
failKnowledgeDedupeRun(input)
listKnowledgeDedupeRuns(limit = 10)
getKnowledgeDedupeRun(id)
createKnowledgeDedupeCandidates(runId, groups)
ignoreKnowledgeDedupeCandidate(id, reason)
```

- [ ] **Step 4: Implement scan service**

Export:

```ts
export function normalizeKnowledgeDedupeScanInput(input: unknown)
export async function createKnowledgeDedupeRunForAdmin(input)
export async function listKnowledgeDedupeRunsForAdmin()
export async function getKnowledgeDedupeRunForAdmin(id: string)
export async function ignoreKnowledgeDedupeCandidateForAdmin(id: string, input: unknown)
```

Default threshold is `0.55`. `useAiReview` is accepted but first implementation may store local-only candidates and warning text when AI is unavailable.

- [ ] **Step 5: Run scan tests**

Run: `npm test -- tests/unit/admin-knowledge-dedupe-scan-service.test.ts`

Expected: PASS.

## Task 4: Merge Service

**Files:**
- Create: `src/server/admin/admin-knowledge-dedupe-merge-service.ts`
- Test: `tests/unit/admin-knowledge-dedupe-merge-service.test.ts`

- [ ] **Step 1: Write focused failing tests for pure merge helpers**

Test exported helpers:

```ts
mergeKnowledgeDedupeArrays(["a", "b"], [" b ", "c"]) // ["a", "b", "c"]
mergeKnowledgeDedupeUserState(canonical, duplicate)
replaceDiagnosticKnowledgeItemIds(["dup", "keep", "dup"], new Map([["dup", "keep"]])) // ["keep"]
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/unit/admin-knowledge-dedupe-merge-service.test.ts`

Expected: FAIL because service file does not exist.

- [ ] **Step 3: Implement helpers and transaction skeleton**

Export:

```ts
mergeKnowledgeDedupeArrays
mergeKnowledgeDedupeUserState
replaceDiagnosticKnowledgeItemIds
mergeKnowledgeDedupeCandidateForAdmin
```

The transaction skeleton validates pending candidate, public items, canonical subset, and updates candidate to `stale` or `merged`.

- [ ] **Step 4: Implement dependent-data migration**

Inside the transaction:

1. merge simple arrays and update canonical item
2. move non-conflicting variables
3. move or delete review items by prompt/log rules
4. redirect relations while resolving self/duplicate relations
5. update review logs
6. merge user states
7. merge memory hooks and redirect hook references
8. rewrite diagnostic attempt arrays
9. delete duplicate knowledge items

- [ ] **Step 5: Run merge tests**

Run: `npm test -- tests/unit/admin-knowledge-dedupe-merge-service.test.ts`

Expected: PASS.

## Task 5: API and UI

**Files:**
- Create: `src/app/api/admin/dedupe/runs/route.ts`
- Create: `src/app/api/admin/dedupe/runs/[id]/route.ts`
- Create: `src/app/api/admin/dedupe/candidates/[id]/ignore/route.ts`
- Create: `src/app/api/admin/dedupe/candidates/[id]/merge/route.ts`
- Create: `src/components/admin/knowledge-dedupe-panel.tsx`
- Create: `src/app/admin/dedupe/page.tsx`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add API routes**

Use `withAdminApi`. Return `{ data }` on success and `{ error }` with status 400 for validation failures.

- [ ] **Step 2: Add admin page**

Load domains from `listAdminKnowledgeItemDomainOptions()` and recent runs from `listKnowledgeDedupeRunsForAdmin()`. Render `KnowledgeDedupePanel`.

- [ ] **Step 3: Add client controls**

Implement scan form, recent run selector links, candidate list, ignore button, canonical select, merged checkbox list, and merge button. Keep UI dense and consistent with existing admin pages.

- [ ] **Step 4: Add navigation**

Add `{ href: "/admin/dedupe", label: "知识去重" }` to admin nav and a dashboard quick action.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS.

## Task 6: Full Verification

**Files:**
- All changed files

- [ ] **Step 1: Run targeted unit tests**

Run:

```bash
npm test -- tests/unit/knowledge-dedupe-similarity.test.ts tests/unit/admin-knowledge-dedupe-scan-service.test.ts tests/unit/admin-knowledge-dedupe-merge-service.test.ts tests/unit/admin-schema-shape.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Review git diff**

Run: `git diff --stat` and inspect changed files. Confirm unrelated pre-existing edits were not reverted.

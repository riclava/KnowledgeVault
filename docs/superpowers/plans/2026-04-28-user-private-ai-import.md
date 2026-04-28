# User Private AI Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated learner users import AI-generated knowledge privately, with imported items visible only to the creator and immediately due in that user's review queue.

**Architecture:** Add first-class `KnowledgeItem.visibility` and `createdByUserId` ownership fields, then thread a reusable "visible to user" filter through learner-facing repositories. Reuse the admin import AI preview pipeline while splitting save behavior into public admin import and private learner import.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma 7 generated client, Node test runner via `tsx --test`.

---

## File Map

- `prisma/schema.prisma`: add `KnowledgeItemVisibility`, owner relation, and indexes.
- `prisma/migrations/00000000000000_dev_baseline/migration.sql`: update baseline tables and enum.
- `src/server/repositories/knowledge-item-visibility.ts`: new shared Prisma where helper for public/private visibility.
- `src/server/admin/admin-import-repository.ts`: support public/private save scopes and learner state initialization.
- `src/server/admin/admin-import-service.ts`: add learner preview/save functions while preserving admin behavior.
- `src/app/api/import/route.ts`: new authenticated learner import endpoint.
- `src/components/admin/admin-import-form.tsx`: make endpoint and copy configurable so admin and learner pages reuse one component.
- `src/app/import/page.tsx`: learner import page.
- `src/components/app/phase-shell.tsx`: add "AI 导入" nav item.
- `src/server/repositories/knowledge-item-repository.ts`: apply visibility filters to list/detail/relation/hook lookups.
- `src/server/repositories/diagnostic-repository.ts`: apply visibility filters to diagnostic question and submission lookups.
- `src/server/repositories/review-repository.ts`: apply visibility filters to review queues and active review item lookup.
- `src/server/services/diagnostic-service.ts`: pass `userId` into diagnostic repository and summary lookups.
- `src/app/api/diagnostic/start/route.ts`: pass current learner to diagnostic start.
- `tests/unit/user-private-import.test.ts`: unit tests for private import plan/save behavior.
- `tests/unit/knowledge-item-visibility.test.ts`: unit tests for visibility helper shapes.
- Existing admin import and schema tests: update expectations for the new enum/fields.

## Task 1: Data Model And Visibility Helper

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/00000000000000_dev_baseline/migration.sql`
- Create: `src/server/repositories/knowledge-item-visibility.ts`
- Test: `tests/unit/knowledge-item-visibility.test.ts`

- [ ] **Step 1: Write the failing visibility helper tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildKnowledgeItemVisibilityWhere,
  buildOwnedKnowledgeItemData,
} from "@/server/repositories/knowledge-item-visibility";

describe("knowledge item visibility", () => {
  it("allows anonymous reads to public items only", () => {
    assert.deepEqual(buildKnowledgeItemVisibilityWhere(), { visibility: "public" });
  });

  it("allows authenticated learners to read public and own private items", () => {
    assert.deepEqual(buildKnowledgeItemVisibilityWhere("user_1"), {
      OR: [
        { visibility: "public" },
        { visibility: "private", createdByUserId: "user_1" },
      ],
    });
  });

  it("builds public and private ownership data", () => {
    assert.deepEqual(buildOwnedKnowledgeItemData({ scope: "admin" }), {
      visibility: "public",
      createdByUserId: null,
    });
    assert.deepEqual(
      buildOwnedKnowledgeItemData({ scope: "learner", userId: "user_1" }),
      {
        visibility: "private",
        createdByUserId: "user_1",
      },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/knowledge-item-visibility.test.ts`
Expected: FAIL because `knowledge-item-visibility.ts` does not exist.

- [ ] **Step 3: Implement schema and helper**

Add enum and fields in Prisma:

```prisma
enum KnowledgeItemVisibility {
  public
  private
}

model User {
  createdKnowledgeItems KnowledgeItem[] @relation("KnowledgeItemCreator")
}

model KnowledgeItem {
  visibility      KnowledgeItemVisibility @default(public)
  createdByUserId String?
  createdByUser   User?                   @relation("KnowledgeItemCreator", fields: [createdByUserId], references: [id], onDelete: Cascade)

  @@index([visibility, createdByUserId])
}
```

Create `src/server/repositories/knowledge-item-visibility.ts`:

```ts
import type { Prisma } from "@/generated/prisma/client";

export type KnowledgeItemWriteScope =
  | { scope: "admin" }
  | { scope: "learner"; userId: string };

export function buildKnowledgeItemVisibilityWhere(
  userId?: string,
): Prisma.KnowledgeItemWhereInput {
  if (!userId) {
    return { visibility: "public" };
  }

  return {
    OR: [
      { visibility: "public" },
      { visibility: "private", createdByUserId: userId },
    ],
  };
}

export function buildOwnedKnowledgeItemData(scope: KnowledgeItemWriteScope) {
  if (scope.scope === "learner") {
    return {
      visibility: "private" as const,
      createdByUserId: scope.userId,
    };
  }

  return {
    visibility: "public" as const,
    createdByUserId: null,
  };
}
```

Update baseline SQL with `knowledge_item_visibility` enum, `knowledge_items.visibility`, `knowledge_items.created_by_user_id`, index, and foreign key.

- [ ] **Step 4: Generate Prisma client and verify test passes**

Run: `npm run prisma:generate`
Expected: Prisma client generation succeeds.

Run: `npm test -- tests/unit/knowledge-item-visibility.test.ts`
Expected: PASS.

## Task 2: Private Import Save Behavior

**Files:**
- Modify: `src/server/admin/admin-import-repository.ts`
- Modify: `src/server/admin/admin-import-service.ts`
- Test: `tests/unit/user-private-import.test.ts`
- Update: `tests/unit/admin-import-write-plan.test.ts`
- Update: `tests/unit/admin-import-service.test.ts`

- [ ] **Step 1: Write failing tests for private slug planning and training state**

Add tests that call pure helpers:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPrivateImportSlugMap,
  buildInitialImportedKnowledgeItemState,
} from "@/server/admin/admin-import-repository";

describe("user private import", () => {
  it("keeps free slugs and suffixes occupied slugs for private imports", () => {
    const slugMap = buildPrivateImportSlugMap({
      requestedSlugs: ["linear-map", "chain-rule"],
      occupiedSlugs: new Set(["linear-map"]),
      namespace: "usrabc123456",
    });

    assert.deepEqual(Object.fromEntries(slugMap), {
      "linear-map": "linear-map-usrabc12",
      "chain-rule": "chain-rule",
    });
  });

  it("initializes imported knowledge as due now for the creator", () => {
    const now = new Date("2026-04-28T00:00:00.000Z");

    assert.deepEqual(
      buildInitialImportedKnowledgeItemState({
        userId: "user_1",
        knowledgeItemId: "item_1",
        difficulty: 4,
        now,
      }),
      {
        userId: "user_1",
        knowledgeItemId: "item_1",
        memoryStrength: 0.05,
        stability: 0,
        difficultyEstimate: 4,
        nextReviewAt: now,
      },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/user-private-import.test.ts`
Expected: FAIL because helper exports do not exist.

- [ ] **Step 3: Implement private save helpers and repository scope**

Add `ImportSaveScope = { scope: "admin"; adminUserId: string } | { scope: "learner"; userId: string }`.

Add exports:

```ts
export function buildPrivateImportSlugMap({
  requestedSlugs,
  occupiedSlugs,
  namespace,
}: {
  requestedSlugs: string[];
  occupiedSlugs: Set<string>;
  namespace: string;
}) {
  const suffix = namespace.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "private";
  return new Map(
    requestedSlugs.map((slug) => [
      slug,
      occupiedSlugs.has(slug) ? `${slug}-${suffix}` : slug,
    ]),
  );
}

export function buildInitialImportedKnowledgeItemState({
  userId,
  knowledgeItemId,
  difficulty,
  now,
}: {
  userId: string;
  knowledgeItemId: string;
  difficulty: number;
  now: Date;
}) {
  return {
    userId,
    knowledgeItemId,
    memoryStrength: 0.05,
    stability: 0,
    difficultyEstimate: difficulty,
    nextReviewAt: now,
  };
}
```

Refactor `saveAdminImportBatch` to accept `saveScope`. Admin scope updates public items by slug. Learner scope always creates private items using the slug map, then upserts learner states due now.

- [ ] **Step 4: Add learner service wrappers**

In `admin-import-service.ts`, add:

```ts
export async function previewLearnerImport({ userId, input }: { userId: string; input: AdminImportRequest }) { ... }
export async function savePreviewedLearnerImport({ userId, importRunId }: { userId: string; importRunId: string }) { ... }
```

They mirror admin preview/save but use learner ownership and only retrieve runs created by that learner.

- [ ] **Step 5: Run focused import tests**

Run: `npm test -- tests/unit/user-private-import.test.ts tests/unit/admin-import-service.test.ts tests/unit/admin-import-write-plan.test.ts`
Expected: PASS.

## Task 3: Learner Visibility Filters

**Files:**
- Modify: `src/server/repositories/knowledge-item-repository.ts`
- Modify: `src/server/repositories/diagnostic-repository.ts`
- Modify: `src/server/repositories/review-repository.ts`
- Modify: `src/server/services/knowledge-item-service.ts`
- Modify: `src/server/services/diagnostic-service.ts`
- Modify: `src/server/services/review-service.ts`
- Modify: `src/app/api/diagnostic/start/route.ts`
- Test: existing unit tests plus new assertions in `tests/unit/knowledge-item-visibility.test.ts`

- [ ] **Step 1: Extend tests with repository source assertions**

Assert repository files contain `buildKnowledgeItemVisibilityWhere` and use `userId` in learner paths:

```ts
import { readFileSync } from "node:fs";

it("threads visibility filters through learner repositories", () => {
  for (const path of [
    "src/server/repositories/knowledge-item-repository.ts",
    "src/server/repositories/diagnostic-repository.ts",
    "src/server/repositories/review-repository.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /buildKnowledgeItemVisibilityWhere/);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/knowledge-item-visibility.test.ts`
Expected: FAIL because repositories do not import the helper yet.

- [ ] **Step 3: Apply visibility where filters**

Use:

```ts
knowledgeItem: {
  ...buildKnowledgeItemVisibilityWhere(userId),
  domain,
}
```

For top-level knowledge item lookups:

```ts
where: {
  AND: [
    buildKnowledgeItemVisibilityWhere(userId),
    { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  ],
}
```

Pass `userId` from services and route handlers into repository methods.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/unit/knowledge-item-visibility.test.ts tests/unit/review-rules.test.ts tests/unit/diagnostic-rules.test.ts`
Expected: PASS.

## Task 4: Learner Import API And UI

**Files:**
- Create: `src/app/api/import/route.ts`
- Create: `src/app/import/page.tsx`
- Modify: `src/components/admin/admin-import-form.tsx`
- Modify: `src/components/app/phase-shell.tsx`
- Test: `tests/unit/admin-ui-copy.test.ts`
- Test: `tests/unit/ux-interaction-regression.test.ts`

- [ ] **Step 1: Write failing UI/API source tests**

Add assertions that `/api/import` uses `withAuthenticatedApi`, `PhaseShell` includes `AI 导入`, and learner page passes `/api/import` plus private-copy labels into `AdminImportForm`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/admin-ui-copy.test.ts tests/unit/ux-interaction-regression.test.ts`
Expected: FAIL on missing learner import route/page/nav.

- [ ] **Step 3: Implement API route**

```ts
import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import {
  normalizeAdminImportActionRequest,
  previewLearnerImport,
  savePreviewedLearnerImport,
} from "@/server/admin/admin-import-service";

export async function POST(request: Request) {
  return withAuthenticatedApi(async (current) => {
    const action = normalizeAdminImportActionRequest(await request.json());
    const result = action.mode === "preview"
      ? await previewLearnerImport({ userId: current.learner.id, input: action.input })
      : await savePreviewedLearnerImport({ userId: current.learner.id, importRunId: action.importRunId });

    return NextResponse.json({ data: result });
  });
}
```

- [ ] **Step 4: Make import form configurable**

Add props:

```ts
type AdminImportFormProps = {
  endpoint?: string;
  introCopy?: string;
  confirmCopy?: string;
  successCopy?: string;
};
```

Default to current admin behavior. Use `endpoint` instead of hard-coded `/api/admin/import`.

- [ ] **Step 5: Add learner page and nav**

Create `/import` using `requireCurrentLearner`, `resolveLearningDomain`, `PhaseShell`, and `AdminImportForm endpoint="/api/import"`.

Add a nav item in `PhaseShell`:

```ts
{
  href: "/import",
  label: "AI 导入",
  icon: Sparkles,
  description: "把材料导入到我的知识库。",
}
```

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/unit/admin-ui-copy.test.ts tests/unit/ux-interaction-regression.test.ts`
Expected: PASS.

## Task 5: Final Verification

**Files:**
- All touched files

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: all unit tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no lint errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Next.js build succeeds.

- [ ] **Step 4: Summarize changed files**

Run: `git status --short`
Expected: only intentional files are listed, plus pre-existing unrelated user changes remain untouched.

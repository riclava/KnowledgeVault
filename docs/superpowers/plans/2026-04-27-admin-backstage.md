# Admin Backstage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only content backstage with form-based knowledge item maintenance and AI-assisted bulk import from pasted source material.

**Architecture:** Add admin-only server modules under `src/server/admin`, route handlers under `src/app/api/admin`, and UI routes under `src/app/admin`. The AI import path produces a structured batch, validates the whole batch, then writes all generated items, variables, review items, and relations in one Prisma transaction.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, Better Auth, Tailwind CSS, shadcn/base UI components, native `fetch` for OpenAI Responses API structured outputs.

---

## File Structure

- Modify `prisma/schema.prisma`: add `UserRole`, `AdminImportStatus`, `User.role`, `User.adminImportRuns`, and `AdminImportRun`.
- Modify `prisma/migrations/00000000000000_dev_baseline/migration.sql`: update the development baseline directly with the same schema changes.
- Modify `src/server/auth/current-learner.ts`: include learner role in `CurrentLearner`.
- Create `src/server/admin/admin-auth.ts`: shared page/API admin authorization.
- Create `src/server/admin/admin-import-types.ts`: strict input/output types for admin imports.
- Create `src/server/admin/admin-import-validation.ts`: pure normalization and validation functions.
- Create `src/server/admin/admin-import-ai.ts`: mock and OpenAI-backed AI generation.
- Create `src/server/admin/admin-import-repository.ts`: transaction save and import-run persistence.
- Create `src/server/admin/admin-import-service.ts`: orchestrates AI generation, validation, import-run recording, and save.
- Create `src/server/admin/admin-dashboard-service.ts`: counts and recent import runs.
- Create `src/server/admin/admin-knowledge-item-service.ts`: admin list/detail/save/delete operations.
- Create `src/app/admin/layout.tsx`: admin shell and access gate.
- Create `src/app/admin/page.tsx`: dashboard page.
- Create `src/app/admin/import/page.tsx`: import page.
- Create `src/components/admin/admin-import-form.tsx`: client import form and result display.
- Create `src/app/admin/knowledge-items/page.tsx`: searchable item list.
- Create `src/app/admin/knowledge-items/new/page.tsx`: create form page.
- Create `src/app/admin/knowledge-items/[id]/edit/page.tsx`: edit form page.
- Create `src/components/admin/knowledge-item-admin-form.tsx`: client form for item aggregate editing.
- Create `src/app/api/admin/dashboard/route.ts`
- Create `src/app/api/admin/import/route.ts`
- Create `src/app/api/admin/import-runs/route.ts`
- Create `src/app/api/admin/import-runs/[id]/route.ts`
- Create `src/app/api/admin/knowledge-items/route.ts`
- Create `src/app/api/admin/knowledge-items/[id]/route.ts`
- Modify `.env.example`: document `OPENAI_API_KEY`, `OPENAI_IMPORT_MODEL`, and `ADMIN_IMPORT_PROVIDER`.
- Add tests under `tests/unit/admin-*.test.ts`.

## Task 1: Schema And Baseline

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/00000000000000_dev_baseline/migration.sql`
- Test: `tests/unit/admin-schema-shape.test.ts`

- [ ] **Step 1: Write the schema shape test**

Create `tests/unit/admin-schema-shape.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const baseline = readFileSync(
  "prisma/migrations/00000000000000_dev_baseline/migration.sql",
  "utf8",
);

describe("admin schema shape", () => {
  it("adds database roles and import-run tracking", () => {
    assert.match(schema, /enum UserRole\s*{\s*learner\s*admin\s*}/s);
    assert.match(schema, /role\s+UserRole\s+@default\(learner\)/);
    assert.match(schema, /enum AdminImportStatus\s*{\s*validation_failed\s*saved\s*ai_failed\s*}/s);
    assert.match(schema, /model AdminImportRun\s*{/);
    assert.match(schema, /adminUser\s+User\s+@relation/);
  });

  it("updates the development baseline directly", () => {
    assert.match(baseline, /CREATE TYPE "UserRole" AS ENUM \('learner', 'admin'\)/);
    assert.match(baseline, /"role" "UserRole" NOT NULL DEFAULT 'learner'/);
    assert.match(baseline, /CREATE TYPE "AdminImportStatus" AS ENUM/);
    assert.match(baseline, /CREATE TABLE "admin_import_runs"/);
    assert.match(baseline, /admin_import_runs_adminUserId_createdAt_idx/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-schema-shape.test.ts`

Expected: FAIL because `UserRole` and `AdminImportRun` do not exist yet.

- [ ] **Step 3: Update Prisma schema**

Modify `prisma/schema.prisma`:

```prisma
enum UserRole {
  learner
  admin
}

enum AdminImportStatus {
  validation_failed
  saved
  ai_failed
}
```

Add to `model User`:

```prisma
  role               UserRole @default(learner)
  adminImportRuns    AdminImportRun[]
```

Add after `StudySession`:

```prisma
model AdminImportRun {
  id               String            @id @default(cuid())
  adminUserId      String
  sourceTitle      String?
  sourceExcerpt    String
  defaultDomain    String
  status           AdminImportStatus
  generatedCount   Int               @default(0)
  savedCount       Int               @default(0)
  validationErrors Json?
  aiOutput         Json?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  adminUser User @relation(fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId, createdAt])
  @@index([status, createdAt])
  @@map("admin_import_runs")
}
```

- [ ] **Step 4: Update the baseline SQL**

Modify `prisma/migrations/00000000000000_dev_baseline/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('learner', 'admin');

-- CreateEnum
CREATE TYPE "AdminImportStatus" AS ENUM ('validation_failed', 'saved', 'ai_failed');
```

Add `"role"` to the `users` table:

```sql
    "role" "UserRole" NOT NULL DEFAULT 'learner',
```

Add table, indexes, and foreign key:

```sql
-- CreateTable
CREATE TABLE "admin_import_runs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceExcerpt" TEXT NOT NULL,
    "defaultDomain" TEXT NOT NULL,
    "status" "AdminImportStatus" NOT NULL,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "validationErrors" JSONB,
    "aiOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_import_runs_adminUserId_createdAt_idx" ON "admin_import_runs"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_import_runs_status_createdAt_idx" ON "admin_import_runs"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "admin_import_runs" ADD CONSTRAINT "admin_import_runs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Generate Prisma client and run the schema test**

Run:

```bash
npm run prisma:generate
npm run test -- tests/unit/admin-schema-shape.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/00000000000000_dev_baseline/migration.sql tests/unit/admin-schema-shape.test.ts src/generated
git commit -m "feat: add admin schema"
```

## Task 2: Admin Authorization

**Files:**
- Modify: `src/server/auth/current-learner.ts`
- Create: `src/server/admin/admin-auth.ts`
- Test: `tests/unit/admin-auth.test.ts`

- [ ] **Step 1: Write the failing authorization test**

Create `tests/unit/admin-auth.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AdminAccessError, assertAdminCurrentLearner } from "@/server/admin/admin-auth";

const baseCurrent = {
  learner: {
    id: "learner_1",
    email: "admin@example.com",
    displayName: "Admin",
    role: "learner" as const,
  },
  anonymous: false,
  authSession: null,
  authUser: {
    id: "auth_1",
    email: "admin@example.com",
    name: "Admin",
    learnerId: "learner_1",
  },
};

describe("admin authorization", () => {
  it("accepts admin learners", () => {
    const admin = assertAdminCurrentLearner({
      ...baseCurrent,
      learner: { ...baseCurrent.learner, role: "admin" },
    });

    assert.deepEqual(admin, {
      id: "learner_1",
      email: "admin@example.com",
      displayName: "Admin",
      role: "admin",
    });
  });

  it("rejects regular learners with a typed access error", () => {
    assert.throws(
      () => assertAdminCurrentLearner(baseCurrent),
      (error) =>
        error instanceof AdminAccessError &&
        error.status === 403 &&
        error.message === "需要管理员权限。",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-auth.test.ts`

Expected: FAIL because `src/server/admin/admin-auth.ts` does not exist.

- [ ] **Step 3: Include role in current learner**

Modify `src/server/auth/current-learner.ts`:

```ts
export type CurrentLearner = {
  learner: {
    id: string;
    email: string | null;
    displayName: string | null;
    role: "learner" | "admin";
  };
  anonymous: boolean;
  authSession: AuthSession;
  authUser: {
    id: string;
    email: string;
    name: string;
    learnerId: string | null;
  } | null;
};
```

Update the returned learner object:

```ts
learner: {
  id: authUser.learner!.id,
  email: authUser.learner!.email,
  displayName: authUser.learner!.displayName,
  role: authUser.learner!.role,
},
```

- [ ] **Step 4: Add admin auth helper**

Create `src/server/admin/admin-auth.ts`:

```ts
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  getCurrentLearner,
  type CurrentLearner,
} from "@/server/auth/current-learner";

export type AdminPrincipal = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: "admin";
};

export class AdminAccessError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AdminAccessError";
  }
}

export function assertAdminCurrentLearner(current: CurrentLearner): AdminPrincipal {
  if (current.learner.role !== "admin") {
    throw new AdminAccessError(403, "需要管理员权限。");
  }

  return {
    id: current.learner.id,
    email: current.learner.email,
    displayName: current.learner.displayName,
    role: "admin",
  };
}

export async function requireAdminPage() {
  const current = await getCurrentLearner();

  if (!current) {
    redirect("/account");
  }

  try {
    return assertAdminCurrentLearner(current);
  } catch {
    redirect("/");
  }
}

export async function withAdminApi<T>(handler: (admin: AdminPrincipal) => Promise<T> | T) {
  const current = await getCurrentLearner();

  if (!current) {
    return NextResponse.json({ error: "请先登录后再继续。" }, { status: 401 });
  }

  try {
    return handler(assertAdminCurrentLearner(current));
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/unit/admin-auth.test.ts
npm run test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/auth/current-learner.ts src/server/admin/admin-auth.ts tests/unit/admin-auth.test.ts
git commit -m "feat: add admin authorization"
```

## Task 3: Import Types And Validation

**Files:**
- Create: `src/server/admin/admin-import-types.ts`
- Create: `src/server/admin/admin-import-validation.ts`
- Test: `tests/unit/admin-import-validation.test.ts`

- [ ] **Step 1: Write validation tests**

Create `tests/unit/admin-import-validation.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeAdminImportBatch,
  validateAdminImportBatch,
} from "@/server/admin/admin-import-validation";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";

const validBatch: AdminImportBatch = {
  sourceTitle: "Algebra notes",
  defaultDomain: "数学",
  items: [
    {
      slug: "linear-equation",
      title: "Linear Equation",
      contentType: "plain_text",
      renderPayload: { text: "A linear equation has degree one." },
      domain: "数学",
      subdomain: "代数",
      summary: "一次方程是未知数最高次数为一的方程。",
      body: "一次方程可以通过等式两边同做逆运算求解。",
      intuition: "把未知数隔离出来。",
      deepDive: "",
      useConditions: ["未知数最高次数为一"],
      nonUseConditions: ["含有二次项"],
      antiPatterns: ["移项后忘记变号"],
      typicalProblems: ["Solve 2x + 3 = 7"],
      examples: ["2x + 3 = 7 -> x = 2"],
      difficulty: 1,
      tags: [" algebra ", "equation", "algebra"],
      variables: [],
      reviewItems: [
        {
          type: "recall",
          prompt: "什么是一次方程？",
          answer: "未知数最高次数为一的方程。",
          explanation: "次数由未知数最高幂决定。",
          difficulty: 1,
        },
      ],
    },
  ],
  relations: [],
};

describe("admin import validation", () => {
  it("normalizes generated item fields", () => {
    const normalized = normalizeAdminImportBatch(validBatch);

    assert.equal(normalized.items[0].slug, "linear-equation");
    assert.deepEqual(normalized.items[0].tags, ["algebra", "equation"]);
    assert.equal(normalized.items[0].subdomain, "代数");
  });

  it("accepts a valid generated batch", () => {
    const result = validateAdminImportBatch(validBatch, new Set());

    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.batch.items.length : 0, 1);
  });

  it("rejects duplicate slugs and missing relation endpoints", () => {
    const invalid: AdminImportBatch = {
      ...validBatch,
      items: [validBatch.items[0], { ...validBatch.items[0], title: "Duplicate" }],
      relations: [
        {
          fromSlug: "linear-equation",
          toSlug: "missing-target",
          relationType: "related",
          note: "",
        },
      ],
    };

    const result = validateAdminImportBatch(invalid, new Set());

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.ok ? [] : result.errors.map((error) => error.code),
      ["duplicate_slug", "unknown_relation_target"],
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-import-validation.test.ts`

Expected: FAIL because the import modules do not exist.

- [ ] **Step 3: Add import types**

Create `src/server/admin/admin-import-types.ts`:

```ts
import type {
  KnowledgeItemRelationType,
  KnowledgeItemType,
  ReviewItemType,
} from "@/generated/prisma/client";

export type AdminImportedVariable = {
  symbol: string;
  name: string;
  description: string;
  unit?: string;
  sortOrder?: number;
};

export type AdminImportedReviewItem = {
  type: ReviewItemType;
  prompt: string;
  answer: string;
  explanation?: string;
  difficulty: number;
};

export type AdminImportedKnowledgeItem = {
  slug: string;
  title: string;
  contentType: KnowledgeItemType;
  renderPayload: unknown;
  domain: string;
  subdomain?: string;
  summary: string;
  body: string;
  intuition?: string;
  deepDive?: string;
  useConditions: string[];
  nonUseConditions: string[];
  antiPatterns: string[];
  typicalProblems: string[];
  examples: string[];
  difficulty: number;
  tags: string[];
  variables: AdminImportedVariable[];
  reviewItems: AdminImportedReviewItem[];
};

export type AdminImportedRelation = {
  fromSlug: string;
  toSlug: string;
  relationType: KnowledgeItemRelationType;
  note?: string;
};

export type AdminImportBatch = {
  sourceTitle?: string;
  defaultDomain: string;
  items: AdminImportedKnowledgeItem[];
  relations: AdminImportedRelation[];
};

export type AdminImportValidationError = {
  code:
    | "empty_batch"
    | "duplicate_slug"
    | "invalid_slug"
    | "missing_item_field"
    | "invalid_content_type"
    | "invalid_render_payload"
    | "invalid_difficulty"
    | "missing_review_item"
    | "invalid_review_item"
    | "duplicate_variable"
    | "unknown_relation_source"
    | "unknown_relation_target"
    | "self_relation"
    | "duplicate_relation"
    | "invalid_relation_type";
  path: string;
  message: string;
};
```

- [ ] **Step 4: Add validation implementation**

Create `src/server/admin/admin-import-validation.ts`:

```ts
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import type {
  AdminImportedKnowledgeItem,
  AdminImportBatch,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";

const contentTypes = new Set(["math_formula", "vocabulary", "plain_text"]);
const reviewItemTypes = new Set(["recall", "recognition", "application"]);
const relationTypes = new Set([
  "prerequisite",
  "related",
  "confusable",
  "application_of",
]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type AdminImportValidationResult =
  | { ok: true; batch: AdminImportBatch }
  | { ok: false; errors: AdminImportValidationError[] };

export function normalizeAdminImportBatch(batch: AdminImportBatch): AdminImportBatch {
  return {
    sourceTitle: normalizeOptionalString(batch.sourceTitle),
    defaultDomain: batch.defaultDomain.trim(),
    items: batch.items.map(normalizeItem),
    relations: batch.relations.map((relation) => ({
      fromSlug: relation.fromSlug.trim(),
      toSlug: relation.toSlug.trim(),
      relationType: relation.relationType,
      note: normalizeOptionalString(relation.note),
    })),
  };
}

export function validateAdminImportBatch(
  batch: AdminImportBatch,
  existingSlugs: Set<string>,
): AdminImportValidationResult {
  const normalized = normalizeAdminImportBatch(batch);
  const errors: AdminImportValidationError[] = [];
  const generatedSlugs = new Set<string>();

  if (normalized.items.length === 0) {
    errors.push({
      code: "empty_batch",
      path: "items",
      message: "AI 至少需要生成一个知识项。",
    });
  }

  normalized.items.forEach((item, itemIndex) => {
    const path = `items.${itemIndex}`;

    if (!slugPattern.test(item.slug)) {
      errors.push({ code: "invalid_slug", path: `${path}.slug`, message: "slug 只能包含小写字母、数字和连字符。" });
    }

    if (generatedSlugs.has(item.slug)) {
      errors.push({ code: "duplicate_slug", path: `${path}.slug`, message: `批次内重复 slug：${item.slug}` });
    }
    generatedSlugs.add(item.slug);

    for (const field of ["title", "domain", "summary", "body"] as const) {
      if (!item[field]) {
        errors.push({ code: "missing_item_field", path: `${path}.${field}`, message: `${field} 不能为空。` });
      }
    }

    if (!contentTypes.has(item.contentType)) {
      errors.push({ code: "invalid_content_type", path: `${path}.contentType`, message: `不支持的内容类型：${item.contentType}` });
    } else {
      try {
        normalizeKnowledgeItemRenderPayload(item.contentType, item.renderPayload);
      } catch (error) {
        errors.push({
          code: "invalid_render_payload",
          path: `${path}.renderPayload`,
          message: error instanceof Error ? error.message : "renderPayload 无效。",
        });
      }
    }

    if (!isDifficulty(item.difficulty)) {
      errors.push({ code: "invalid_difficulty", path: `${path}.difficulty`, message: "难度必须是 1 到 5 的整数。" });
    }

    if (item.reviewItems.length === 0) {
      errors.push({ code: "missing_review_item", path: `${path}.reviewItems`, message: "每个知识项至少需要一道复习题。" });
    }

    item.reviewItems.forEach((reviewItem, reviewIndex) => {
      const reviewPath = `${path}.reviewItems.${reviewIndex}`;
      if (!reviewItemTypes.has(reviewItem.type) || !reviewItem.prompt || !reviewItem.answer || !isDifficulty(reviewItem.difficulty)) {
        errors.push({ code: "invalid_review_item", path: reviewPath, message: "复习题需要合法类型、题干、答案和 1 到 5 的难度。" });
      }
    });

    const variableSymbols = new Set<string>();
    item.variables.forEach((variable, variableIndex) => {
      const symbol = variable.symbol.trim();
      if (variableSymbols.has(symbol)) {
        errors.push({ code: "duplicate_variable", path: `${path}.variables.${variableIndex}.symbol`, message: `变量符号重复：${symbol}` });
      }
      variableSymbols.add(symbol);
    });
  });

  const resolvableTargetSlugs = new Set([...existingSlugs, ...generatedSlugs]);
  const relationKeys = new Set<string>();
  normalized.relations.forEach((relation, relationIndex) => {
    const path = `relations.${relationIndex}`;
    if (!relationTypes.has(relation.relationType)) {
      errors.push({ code: "invalid_relation_type", path: `${path}.relationType`, message: `不支持的关系类型：${relation.relationType}` });
    }
    if (!generatedSlugs.has(relation.fromSlug)) {
      errors.push({ code: "unknown_relation_source", path: `${path}.fromSlug`, message: `关系来源必须是本批次生成的知识项：${relation.fromSlug}` });
    }
    if (!resolvableTargetSlugs.has(relation.toSlug)) {
      errors.push({ code: "unknown_relation_target", path: `${path}.toSlug`, message: `找不到关系目标：${relation.toSlug}` });
    }
    if (relation.fromSlug === relation.toSlug) {
      errors.push({ code: "self_relation", path, message: "知识项不能关联到自身。" });
    }
    const relationKey = `${relation.fromSlug}:${relation.toSlug}:${relation.relationType}`;
    if (relationKeys.has(relationKey)) {
      errors.push({ code: "duplicate_relation", path, message: `重复关系：${relationKey}` });
    }
    relationKeys.add(relationKey);
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, batch: normalized };
}

function normalizeItem(item: AdminImportedKnowledgeItem): AdminImportedKnowledgeItem {
  return {
    ...item,
    slug: item.slug.trim().toLowerCase(),
    title: item.title.trim(),
    domain: item.domain.trim(),
    subdomain: normalizeOptionalString(item.subdomain),
    summary: item.summary.trim(),
    body: item.body.trim(),
    intuition: normalizeOptionalString(item.intuition),
    deepDive: normalizeOptionalString(item.deepDive),
    useConditions: normalizeStringArray(item.useConditions),
    nonUseConditions: normalizeStringArray(item.nonUseConditions),
    antiPatterns: normalizeStringArray(item.antiPatterns),
    typicalProblems: normalizeStringArray(item.typicalProblems),
    examples: normalizeStringArray(item.examples),
    tags: normalizeStringArray(item.tags),
    variables: item.variables.map((variable, index) => ({
      symbol: variable.symbol.trim(),
      name: variable.name.trim(),
      description: variable.description.trim(),
      unit: normalizeOptionalString(variable.unit),
      sortOrder: variable.sortOrder ?? index,
    })),
    reviewItems: item.reviewItems.map((reviewItem) => ({
      ...reviewItem,
      prompt: reviewItem.prompt.trim(),
      answer: reviewItem.answer.trim(),
      explanation: normalizeOptionalString(reviewItem.explanation),
    })),
  };
}

function normalizeStringArray(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeOptionalString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isDifficulty(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
```

- [ ] **Step 5: Run validation tests**

Run: `npm run test -- tests/unit/admin-import-validation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/admin/admin-import-types.ts src/server/admin/admin-import-validation.ts tests/unit/admin-import-validation.test.ts
git commit -m "feat: validate admin imports"
```

## Task 4: Import Persistence Planning And Repository

**Files:**
- Create: `src/server/admin/admin-import-repository.ts`
- Test: `tests/unit/admin-import-write-plan.test.ts`

- [ ] **Step 1: Write write-plan tests**

Create `tests/unit/admin-import-write-plan.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAdminImportWritePlan } from "@/server/admin/admin-import-repository";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";

const batch: AdminImportBatch = {
  defaultDomain: "数学",
  items: [
    {
      slug: "existing-item",
      title: "Existing Item Updated",
      contentType: "plain_text",
      renderPayload: { text: "Updated" },
      domain: "数学",
      summary: "Updated summary",
      body: "Updated body",
      useConditions: [],
      nonUseConditions: [],
      antiPatterns: [],
      typicalProblems: [],
      examples: [],
      difficulty: 2,
      tags: ["update"],
      variables: [],
      reviewItems: [{ type: "recall", prompt: "Q", answer: "A", difficulty: 2 }],
    },
    {
      slug: "new-item",
      title: "New Item",
      contentType: "plain_text",
      renderPayload: { text: "New" },
      domain: "数学",
      summary: "New summary",
      body: "New body",
      useConditions: [],
      nonUseConditions: [],
      antiPatterns: [],
      typicalProblems: [],
      examples: [],
      difficulty: 1,
      tags: ["new"],
      variables: [],
      reviewItems: [{ type: "recall", prompt: "Q", answer: "A", difficulty: 1 }],
    },
  ],
  relations: [
    {
      fromSlug: "existing-item",
      toSlug: "new-item",
      relationType: "related",
    },
  ],
};

describe("admin import write plan", () => {
  it("separates creates, updates, and relation sources", () => {
    const plan = buildAdminImportWritePlan(batch, new Map([["existing-item", "ki_existing"]]));

    assert.deepEqual(plan.createSlugs, ["new-item"]);
    assert.deepEqual(plan.updateSlugs, ["existing-item"]);
    assert.deepEqual(plan.relationSourceSlugs, ["existing-item"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-import-write-plan.test.ts`

Expected: FAIL because the repository module does not exist.

- [ ] **Step 3: Add repository planning and persistence**

Create `src/server/admin/admin-import-repository.ts`:

```ts
import type { Prisma, AdminImportStatus } from "@/generated/prisma/client";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import { prisma } from "@/lib/db/prisma";
import type {
  AdminImportBatch,
  AdminImportValidationError,
} from "@/server/admin/admin-import-types";

export function buildAdminImportWritePlan(
  batch: AdminImportBatch,
  existingSlugToId: Map<string, string>,
) {
  const createSlugs: string[] = [];
  const updateSlugs: string[] = [];

  for (const item of batch.items) {
    if (existingSlugToId.has(item.slug)) {
      updateSlugs.push(item.slug);
    } else {
      createSlugs.push(item.slug);
    }
  }

  return {
    createSlugs,
    updateSlugs,
    relationSourceSlugs: Array.from(new Set(batch.relations.map((relation) => relation.fromSlug))),
  };
}

export async function listExistingKnowledgeItemIdsBySlug(slugs: string[]) {
  const rows = await prisma.knowledgeItem.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });

  return new Map(rows.map((row) => [row.slug, row.id]));
}

export async function createAdminImportRun(data: {
  adminUserId: string;
  sourceTitle?: string;
  sourceExcerpt: string;
  defaultDomain: string;
  status: AdminImportStatus;
  generatedCount: number;
  savedCount: number;
  validationErrors?: AdminImportValidationError[];
  aiOutput?: unknown;
}) {
  return prisma.adminImportRun.create({
    data: {
      adminUserId: data.adminUserId,
      sourceTitle: data.sourceTitle,
      sourceExcerpt: data.sourceExcerpt,
      defaultDomain: data.defaultDomain,
      status: data.status,
      generatedCount: data.generatedCount,
      savedCount: data.savedCount,
      validationErrors: jsonOrNull(data.validationErrors),
      aiOutput: jsonOrNull(data.aiOutput),
    },
  });
}

export async function saveAdminImportBatch({
  adminUserId,
  sourceTitle,
  sourceExcerpt,
  batch,
  aiOutput,
}: {
  adminUserId: string;
  sourceTitle?: string;
  sourceExcerpt: string;
  batch: AdminImportBatch;
  aiOutput: unknown;
}) {
  return prisma.$transaction(async (tx) => {
    const referencedSlugs = Array.from(
      new Set([
        ...batch.items.map((item) => item.slug),
        ...batch.relations.map((relation) => relation.fromSlug),
        ...batch.relations.map((relation) => relation.toSlug),
      ]),
    );
    const existing = await tx.knowledgeItem.findMany({
      where: { slug: { in: referencedSlugs } },
      select: { id: true, slug: true },
    });
    const slugToId = new Map(existing.map((item) => [item.slug, item.id]));

    for (const item of batch.items) {
      const data = {
        slug: item.slug,
        title: item.title,
        contentType: item.contentType,
        renderPayload: normalizeKnowledgeItemRenderPayload(item.contentType, item.renderPayload),
        domain: item.domain,
        subdomain: item.subdomain ?? null,
        summary: item.summary,
        body: item.body,
        intuition: item.intuition ?? null,
        deepDive: item.deepDive ?? null,
        useConditions: item.useConditions,
        nonUseConditions: item.nonUseConditions,
        antiPatterns: item.antiPatterns,
        typicalProblems: item.typicalProblems,
        examples: item.examples,
        difficulty: item.difficulty,
        tags: item.tags,
      } satisfies Prisma.KnowledgeItemUncheckedCreateInput;

      const saved = slugToId.has(item.slug)
        ? await tx.knowledgeItem.update({ where: { slug: item.slug }, data })
        : await tx.knowledgeItem.create({ data });

      slugToId.set(item.slug, saved.id);

      await tx.knowledgeItemVariable.deleteMany({ where: { knowledgeItemId: saved.id } });
      await tx.knowledgeItemVariable.createMany({
        data: item.variables.map((variable, index) => ({
          knowledgeItemId: saved.id,
          symbol: variable.symbol,
          name: variable.name,
          description: variable.description,
          unit: variable.unit ?? null,
          sortOrder: variable.sortOrder ?? index,
        })),
      });

      await tx.reviewItem.deleteMany({ where: { knowledgeItemId: saved.id } });
      await tx.reviewItem.createMany({
        data: item.reviewItems.map((reviewItem) => ({
          knowledgeItemId: saved.id,
          type: reviewItem.type,
          prompt: reviewItem.prompt,
          answer: reviewItem.answer,
          explanation: reviewItem.explanation ?? null,
          difficulty: reviewItem.difficulty,
        })),
      });
    }

    const relationSourceIds = batch.relations
      .map((relation) => slugToId.get(relation.fromSlug))
      .filter((id): id is string => Boolean(id));
    await tx.knowledgeItemRelation.deleteMany({
      where: { fromKnowledgeItemId: { in: Array.from(new Set(relationSourceIds)) } },
    });

    await tx.knowledgeItemRelation.createMany({
      data: batch.relations.map((relation) => ({
        fromKnowledgeItemId: slugToId.get(relation.fromSlug)!,
        toKnowledgeItemId: slugToId.get(relation.toSlug)!,
        relationType: relation.relationType,
        note: relation.note ?? null,
      })),
      skipDuplicates: true,
    });

    return tx.adminImportRun.create({
      data: {
        adminUserId,
        sourceTitle,
        sourceExcerpt,
        defaultDomain: batch.defaultDomain,
        status: "saved",
        generatedCount: batch.items.length,
        savedCount: batch.items.length,
        aiOutput: jsonOrNull(aiOutput),
      },
    });
  });
}

export async function listRecentAdminImportRuns(take = 10) {
  return prisma.adminImportRun.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}

function jsonOrNull(value: unknown) {
  return value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
```

- [ ] **Step 4: Run repository planning tests**

Run: `npm run test -- tests/unit/admin-import-write-plan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/admin-import-repository.ts tests/unit/admin-import-write-plan.test.ts
git commit -m "feat: add admin import persistence"
```

## Task 5: AI Import Provider

**Files:**
- Create: `src/server/admin/admin-import-ai.ts`
- Modify: `.env.example`
- Test: `tests/unit/admin-import-ai.test.ts`

- [ ] **Step 1: Write provider tests**

Create `tests/unit/admin-import-ai.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAdminImportJsonSchema,
  extractResponseOutputText,
  generateMockAdminImportBatch,
} from "@/server/admin/admin-import-ai";

describe("admin import AI provider", () => {
  it("creates a strict structured output schema", () => {
    const schema = createAdminImportJsonSchema();

    assert.equal(schema.type, "json_schema");
    assert.equal(schema.strict, true);
    assert.equal(schema.schema.additionalProperties, false);
    assert.deepEqual(schema.schema.required, ["sourceTitle", "defaultDomain", "items", "relations"]);
  });

  it("generates a deterministic mock batch for tests and local UI", async () => {
    const batch = await generateMockAdminImportBatch({
      sourceMaterial: "线性方程是一类最高次数为一的方程。",
      sourceTitle: "线性方程笔记",
      defaultDomain: "数学",
      defaultSubdomain: "代数",
    });

    assert.equal(batch.defaultDomain, "数学");
    assert.equal(batch.items.length, 1);
    assert.equal(batch.items[0].slug, "mock-linear-equation");
    assert.equal(batch.items[0].reviewItems.length, 3);
  });

  it("extracts text from raw Responses API output", () => {
    assert.equal(
      extractResponseOutputText({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: "{\"items\":[]}",
              },
            ],
          },
        ],
      }),
      "{\"items\":[]}",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-import-ai.test.ts`

Expected: FAIL because `admin-import-ai.ts` does not exist.

- [ ] **Step 3: Add AI provider module**

Create `src/server/admin/admin-import-ai.ts`:

```ts
import type { AdminImportBatch } from "@/server/admin/admin-import-types";

export type AdminImportGenerateInput = {
  sourceMaterial: string;
  sourceTitle?: string;
  defaultDomain: string;
  defaultSubdomain?: string;
  preferredContentTypes?: string[];
};

export function createAdminImportJsonSchema() {
  return {
    type: "json_schema" as const,
    name: "knowledge_vault_admin_import_batch",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["sourceTitle", "defaultDomain", "items", "relations"],
      properties: {
        sourceTitle: { type: "string" },
        defaultDomain: { type: "string" },
        items: {
          type: "array",
          items: { $ref: "#/$defs/item" },
        },
        relations: {
          type: "array",
          items: { $ref: "#/$defs/relation" },
        },
      },
      $defs: {
        item: {
          type: "object",
          additionalProperties: false,
          required: [
            "slug",
            "title",
            "contentType",
            "renderPayload",
            "domain",
            "subdomain",
            "summary",
            "body",
            "intuition",
            "deepDive",
            "useConditions",
            "nonUseConditions",
            "antiPatterns",
            "typicalProblems",
            "examples",
            "difficulty",
            "tags",
            "variables",
            "reviewItems",
          ],
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            contentType: { type: "string", enum: ["math_formula", "vocabulary", "plain_text"] },
            renderPayload: {
              anyOf: [
                { $ref: "#/$defs/mathFormulaPayload" },
                { $ref: "#/$defs/vocabularyPayload" },
                { $ref: "#/$defs/plainTextPayload" },
              ],
            },
            domain: { type: "string" },
            subdomain: { type: "string" },
            summary: { type: "string" },
            body: { type: "string" },
            intuition: { type: "string" },
            deepDive: { type: "string" },
            useConditions: { type: "array", items: { type: "string" } },
            nonUseConditions: { type: "array", items: { type: "string" } },
            antiPatterns: { type: "array", items: { type: "string" } },
            typicalProblems: { type: "array", items: { type: "string" } },
            examples: { type: "array", items: { type: "string" } },
            difficulty: { type: "integer" },
            tags: { type: "array", items: { type: "string" } },
            variables: { type: "array", items: { $ref: "#/$defs/variable" } },
            reviewItems: { type: "array", items: { $ref: "#/$defs/reviewItem" } },
          },
        },
        variable: {
          type: "object",
          additionalProperties: false,
          required: ["symbol", "name", "description", "unit", "sortOrder"],
          properties: {
            symbol: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            unit: { type: "string" },
            sortOrder: { type: "integer" },
          },
        },
        mathFormulaPayload: {
          type: "object",
          additionalProperties: false,
          required: ["latex"],
          properties: {
            latex: { type: "string" },
          },
        },
        vocabularyPayload: {
          type: "object",
          additionalProperties: false,
          required: ["term", "definition", "phonetic", "partOfSpeech", "examples"],
          properties: {
            term: { type: "string" },
            definition: { type: "string" },
            phonetic: { type: "string" },
            partOfSpeech: { type: "string" },
            examples: { type: "array", items: { type: "string" } },
          },
        },
        plainTextPayload: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: { type: "string" },
          },
        },
        reviewItem: {
          type: "object",
          additionalProperties: false,
          required: ["type", "prompt", "answer", "explanation", "difficulty"],
          properties: {
            type: { type: "string", enum: ["recall", "recognition", "application"] },
            prompt: { type: "string" },
            answer: { type: "string" },
            explanation: { type: "string" },
            difficulty: { type: "integer" },
          },
        },
        relation: {
          type: "object",
          additionalProperties: false,
          required: ["fromSlug", "toSlug", "relationType", "note"],
          properties: {
            fromSlug: { type: "string" },
            toSlug: { type: "string" },
            relationType: { type: "string", enum: ["prerequisite", "related", "confusable", "application_of"] },
            note: { type: "string" },
          },
        },
      },
    },
  };
}

export async function generateAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  if ((process.env.ADMIN_IMPORT_PROVIDER ?? "mock") === "mock") {
    return generateMockAdminImportBatch(input);
  }

  return generateOpenAiAdminImportBatch(input);
}

export async function generateMockAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  return {
    sourceTitle: input.sourceTitle ?? "Mock import",
    defaultDomain: input.defaultDomain,
    items: [
      {
        slug: "mock-linear-equation",
        title: "一次方程",
        contentType: "plain_text",
        renderPayload: { text: "一次方程是未知数最高次数为一的方程。" },
        domain: input.defaultDomain,
        subdomain: input.defaultSubdomain,
        summary: "一次方程可以通过逆运算求解。",
        body: "一次方程的核心是保持等式两边相等，并逐步隔离未知数。",
        intuition: "把未知数留在一边，把常数移到另一边。",
        deepDive: "移项本质上是在等式两边同时加上或减去同一个量。",
        useConditions: ["未知数最高次数为一"],
        nonUseConditions: ["出现二次项或更高次项"],
        antiPatterns: ["移项时忘记改变符号"],
        typicalProblems: ["2x + 3 = 7"],
        examples: ["2x + 3 = 7，所以 x = 2"],
        difficulty: 1,
        tags: ["代数", "方程"],
        variables: [],
        reviewItems: [
          { type: "recall", prompt: "什么是一次方程？", answer: "未知数最高次数为一的方程。", explanation: "关键是最高次数为一。", difficulty: 1 },
          { type: "recognition", prompt: "2x + 3 = 7 是一次方程吗？", answer: "是。", explanation: "未知数 x 的次数为一。", difficulty: 1 },
          { type: "application", prompt: "求解 2x + 3 = 7。", answer: "x = 2。", explanation: "两边减 3，再除以 2。", difficulty: 1 },
        ],
      },
    ],
    relations: [],
  };
}

async function generateOpenAiAdminImportBatch(
  input: AdminImportGenerateInput,
): Promise<AdminImportBatch> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when ADMIN_IMPORT_PROVIDER=openai");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMPORT_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "You convert learning source material into KnowledgeVault import batches. Return concise Chinese learning content. Output must match the JSON schema.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      text: {
        format: createAdminImportJsonSchema(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI import failed with status ${response.status}`);
  }

  const payload = await response.json();
  const outputText = extractResponseOutputText(payload);

  return JSON.parse(outputText) as AdminImportBatch;
}

export function extractResponseOutputText(payload: unknown) {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  if (Array.isArray(record.output)) {
    for (const item of record.output) {
      const itemRecord = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      if (!Array.isArray(itemRecord.content)) {
        continue;
      }

      for (const content of itemRecord.content) {
        const contentRecord = content && typeof content === "object" ? (content as Record<string, unknown>) : {};
        if (contentRecord.type === "output_text" && typeof contentRecord.text === "string") {
          return contentRecord.text;
        }
      }
    }
  }

  throw new Error("OpenAI response did not include output text");
}
```

- [ ] **Step 4: Document environment variables**

Append to `.env.example`:

```bash
# Admin AI import
ADMIN_IMPORT_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_IMPORT_MODEL=gpt-4.1-mini
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- tests/unit/admin-import-ai.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/admin/admin-import-ai.ts tests/unit/admin-import-ai.test.ts .env.example
git commit -m "feat: add admin import ai provider"
```

## Task 6: Import Service And API

**Files:**
- Create: `src/server/admin/admin-import-service.ts`
- Create: `src/app/api/admin/import/route.ts`
- Create: `src/app/api/admin/import-runs/route.ts`
- Create: `src/app/api/admin/import-runs/[id]/route.ts`
- Test: `tests/unit/admin-import-service.test.ts`

- [ ] **Step 1: Write service input tests**

Create `tests/unit/admin-import-service.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeAdminImportRequest } from "@/server/admin/admin-import-service";

describe("admin import service", () => {
  it("normalizes import request body", () => {
    assert.deepEqual(
      normalizeAdminImportRequest({
        sourceMaterial: "  lesson text  ",
        sourceTitle: "  Lesson  ",
        defaultDomain: " 数学 ",
        defaultSubdomain: " 代数 ",
        preferredContentTypes: ["math_formula", "plain_text"],
      }),
      {
        sourceMaterial: "lesson text",
        sourceTitle: "Lesson",
        defaultDomain: "数学",
        defaultSubdomain: "代数",
        preferredContentTypes: ["math_formula", "plain_text"],
      },
    );
  });

  it("rejects missing source material and domain", () => {
    assert.throws(
      () => normalizeAdminImportRequest({ sourceMaterial: "", defaultDomain: "" }),
      /素材和默认领域不能为空/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-import-service.test.ts`

Expected: FAIL because `admin-import-service.ts` does not exist.

- [ ] **Step 3: Add service**

Create `src/server/admin/admin-import-service.ts`:

```ts
import { generateAdminImportBatch } from "@/server/admin/admin-import-ai";
import {
  createAdminImportRun,
  listExistingKnowledgeItemIdsBySlug,
  listRecentAdminImportRuns,
  saveAdminImportBatch,
} from "@/server/admin/admin-import-repository";
import { validateAdminImportBatch } from "@/server/admin/admin-import-validation";

export type AdminImportRequest = {
  sourceMaterial: string;
  sourceTitle?: string;
  defaultDomain: string;
  defaultSubdomain?: string;
  preferredContentTypes?: string[];
};

export function normalizeAdminImportRequest(input: unknown): AdminImportRequest {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const sourceMaterial = String(record.sourceMaterial ?? "").trim();
  const defaultDomain = String(record.defaultDomain ?? "").trim();

  if (!sourceMaterial || !defaultDomain) {
    throw new Error("素材和默认领域不能为空。");
  }

  return {
    sourceMaterial,
    sourceTitle: normalizeOptional(record.sourceTitle),
    defaultDomain,
    defaultSubdomain: normalizeOptional(record.defaultSubdomain),
    preferredContentTypes: Array.isArray(record.preferredContentTypes)
      ? record.preferredContentTypes.map(String)
      : undefined,
  };
}

export async function runAdminImport({
  adminUserId,
  input,
}: {
  adminUserId: string;
  input: AdminImportRequest;
}) {
  const sourceExcerpt = input.sourceMaterial.slice(0, 1000);

  try {
    const generated = await generateAdminImportBatch(input);
    const existingSlugs = await listExistingKnowledgeItemIdsBySlug([
      ...generated.items.map((item) => item.slug),
      ...generated.relations.map((relation) => relation.toSlug),
    ]);
    const validation = validateAdminImportBatch(generated, new Set(existingSlugs.keys()));

    if (!validation.ok) {
      const importRun = await createAdminImportRun({
        adminUserId,
        sourceTitle: input.sourceTitle,
        sourceExcerpt,
        defaultDomain: input.defaultDomain,
        status: "validation_failed",
        generatedCount: generated.items.length,
        savedCount: 0,
        validationErrors: validation.errors,
        aiOutput: generated,
      });

      return { status: "validation_failed" as const, importRun, errors: validation.errors };
    }

    const importRun = await saveAdminImportBatch({
      adminUserId,
      sourceTitle: input.sourceTitle,
      sourceExcerpt,
      batch: validation.batch,
      aiOutput: generated,
    });

    return { status: "saved" as const, importRun, savedCount: validation.batch.items.length };
  } catch (error) {
    const importRun = await createAdminImportRun({
      adminUserId,
      sourceTitle: input.sourceTitle,
      sourceExcerpt,
      defaultDomain: input.defaultDomain,
      status: "ai_failed",
      generatedCount: 0,
      savedCount: 0,
      validationErrors: [
        {
          code: "empty_batch",
          path: "ai",
          message: error instanceof Error ? error.message : "AI 导入失败。",
        },
      ],
    });

    return { status: "ai_failed" as const, importRun };
  }
}

export async function getRecentAdminImportRuns() {
  return listRecentAdminImportRuns(20);
}

function normalizeOptional(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : undefined;
}
```

- [ ] **Step 4: Add API routes**

Create `src/app/api/admin/import/route.ts`:

```ts
import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import {
  normalizeAdminImportRequest,
  runAdminImport,
} from "@/server/admin/admin-import-service";

export async function POST(request: Request) {
  return withAdminApi(async (admin) => {
    const input = normalizeAdminImportRequest(await request.json());
    const result = await runAdminImport({
      adminUserId: admin.id,
      input,
    });

    return NextResponse.json({ data: result });
  });
}
```

Create `src/app/api/admin/import-runs/route.ts`:

```ts
import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import { getRecentAdminImportRuns } from "@/server/admin/admin-import-service";

export async function GET() {
  return withAdminApi(async () => {
    return NextResponse.json({ data: await getRecentAdminImportRuns() });
  });
}
```

Create `src/app/api/admin/import-runs/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(async () => {
    const { id: rawId } = await params;
    const importRun = await prisma.adminImportRun.findUnique({
      where: { id: normalizeRouteParam(rawId) },
    });

    if (!importRun) {
      return NextResponse.json({ error: "Import run not found" }, { status: 404 });
    }

    return NextResponse.json({ data: importRun });
  });
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/unit/admin-import-service.test.ts
npm run test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/admin/admin-import-service.ts src/app/api/admin/import src/app/api/admin/import-runs tests/unit/admin-import-service.test.ts
git commit -m "feat: add admin import api"
```

## Task 7: Admin Dashboard And Knowledge Item Services

**Files:**
- Create: `src/server/admin/admin-dashboard-service.ts`
- Create: `src/server/admin/admin-knowledge-item-service.ts`
- Create: `src/app/api/admin/dashboard/route.ts`
- Create: `src/app/api/admin/knowledge-items/route.ts`
- Create: `src/app/api/admin/knowledge-items/[id]/route.ts`
- Test: `tests/unit/admin-knowledge-item-service.test.ts`

- [ ] **Step 1: Write service normalization tests**

Create `tests/unit/admin-knowledge-item-service.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeAdminKnowledgeItemSearchParams } from "@/server/admin/admin-knowledge-item-service";

describe("admin knowledge item service", () => {
  it("normalizes list query params", () => {
    const params = normalizeAdminKnowledgeItemSearchParams(
      new URLSearchParams("query=  algebra  &domain= Math &contentType=plain_text&difficulty=2&tag=core"),
    );

    assert.deepEqual(params, {
      query: "algebra",
      domain: "Math",
      contentType: "plain_text",
      difficulty: 2,
      tag: "core",
    });
  });

  it("ignores invalid numeric filters", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemSearchParams(new URLSearchParams("difficulty=nope")),
      {},
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-knowledge-item-service.test.ts`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Add dashboard service**

Create `src/server/admin/admin-dashboard-service.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

export async function getAdminDashboard() {
  const [
    knowledgeItemCount,
    reviewItemCount,
    relationCount,
    variableCount,
    recentImportRuns,
  ] = await Promise.all([
    prisma.knowledgeItem.count(),
    prisma.reviewItem.count(),
    prisma.knowledgeItemRelation.count(),
    prisma.knowledgeItemVariable.count(),
    prisma.adminImportRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    knowledgeItemCount,
    reviewItemCount,
    relationCount,
    variableCount,
    recentImportRuns,
  };
}
```

- [ ] **Step 4: Add knowledge item service**

Create `src/server/admin/admin-knowledge-item-service.ts`:

```ts
import type { KnowledgeItemType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AdminKnowledgeItemListParams = {
  query?: string;
  domain?: string;
  contentType?: KnowledgeItemType;
  difficulty?: number;
  tag?: string;
};

export function normalizeAdminKnowledgeItemSearchParams(
  searchParams: URLSearchParams,
): AdminKnowledgeItemListParams {
  const difficultyValue = Number(searchParams.get("difficulty"));
  const difficulty = Number.isInteger(difficultyValue) ? difficultyValue : undefined;

  return stripEmpty({
    query: searchParams.get("query")?.trim(),
    domain: searchParams.get("domain")?.trim(),
    contentType: normalizeContentType(searchParams.get("contentType")),
    difficulty,
    tag: searchParams.get("tag")?.trim(),
  });
}

export async function listAdminKnowledgeItems(params: AdminKnowledgeItemListParams) {
  return prisma.knowledgeItem.findMany({
    where: {
      ...(params.domain ? { domain: params.domain } : {}),
      ...(params.contentType ? { contentType: params.contentType } : {}),
      ...(typeof params.difficulty === "number" ? { difficulty: params.difficulty } : {}),
      ...(params.tag ? { tags: { has: params.tag } } : {}),
      ...(params.query
        ? {
            OR: [
              { title: { contains: params.query, mode: "insensitive" } },
              { slug: { contains: params.query, mode: "insensitive" } },
              { summary: { contains: params.query, mode: "insensitive" } },
              { body: { contains: params.query, mode: "insensitive" } },
              { tags: { has: params.query } },
            ],
          }
        : {}),
    },
    include: {
      _count: {
        select: {
          variables: true,
          reviewItems: true,
          outgoingRelations: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getAdminKnowledgeItem(idOrSlug: string) {
  return prisma.knowledgeItem.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      variables: { orderBy: { sortOrder: "asc" } },
      reviewItems: { orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }] },
      outgoingRelations: {
        include: { toKnowledgeItem: { select: { id: true, slug: true, title: true } } },
        orderBy: [{ relationType: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function deleteAdminKnowledgeItem(id: string) {
  return prisma.knowledgeItem.delete({ where: { id } });
}

function normalizeContentType(value: string | null): KnowledgeItemType | undefined {
  return value === "math_formula" || value === "vocabulary" || value === "plain_text"
    ? value
    : undefined;
}

function stripEmpty<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== ""),
  ) as Partial<T>;
}
```

- [ ] **Step 5: Add API routes**

Create `src/app/api/admin/dashboard/route.ts`:

```ts
import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import { getAdminDashboard } from "@/server/admin/admin-dashboard-service";

export async function GET() {
  return withAdminApi(async () => {
    return NextResponse.json({ data: await getAdminDashboard() });
  });
}
```

Create `src/app/api/admin/knowledge-items/route.ts`:

```ts
import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import {
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
} from "@/server/admin/admin-knowledge-item-service";

export async function GET(request: Request) {
  return withAdminApi(async () => {
    const params = normalizeAdminKnowledgeItemSearchParams(new URL(request.url).searchParams);
    return NextResponse.json({ data: await listAdminKnowledgeItems(params) });
  });
}
```

Create `src/app/api/admin/knowledge-items/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import {
  deleteAdminKnowledgeItem,
  getAdminKnowledgeItem,
} from "@/server/admin/admin-knowledge-item-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(async () => {
    const { id } = await params;
    const item = await getAdminKnowledgeItem(normalizeRouteParam(id));

    if (!item) {
      return NextResponse.json({ error: "Knowledge item not found" }, { status: 404 });
    }

    return NextResponse.json({ data: item });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(async () => {
    const { id } = await params;
    await deleteAdminKnowledgeItem(normalizeRouteParam(id));
    return NextResponse.json({ data: { deleted: true } });
  });
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- tests/unit/admin-knowledge-item-service.test.ts
npm run test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/admin/admin-dashboard-service.ts src/server/admin/admin-knowledge-item-service.ts src/app/api/admin tests/unit/admin-knowledge-item-service.test.ts
git commit -m "feat: add admin content apis"
```

## Task 8: Admin UI Shell, Import Page, And List Page

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/import/page.tsx`
- Create: `src/components/admin/admin-import-form.tsx`
- Create: `src/app/admin/knowledge-items/page.tsx`
- Test: `tests/unit/admin-ui-copy.test.ts`

- [ ] **Step 1: Write UI copy smoke test**

Create `tests/unit/admin-ui-copy.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("admin UI files", () => {
  it("contains the backstage navigation and AI import action", () => {
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    const importForm = readFileSync("src/components/admin/admin-import-form.tsx", "utf8");

    assert.match(layout, /AI 导入/);
    assert.match(layout, /知识项/);
    assert.match(importForm, /生成并保存/);
    assert.match(importForm, /sourceMaterial/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-ui-copy.test.ts`

Expected: FAIL because the UI files do not exist.

- [ ] **Step 3: Add admin layout**

Create `src/app/admin/layout.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/server/admin/admin-auth";

const navItems = [
  { href: "/admin", label: "总览" },
  { href: "/admin/import", label: "AI 导入" },
  { href: "/admin/knowledge-items", label: "知识项" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border bg-background p-4">
          <div className="mb-5">
            <p className="text-sm text-muted-foreground">KnowledgeVault</p>
            <h1 className="text-lg font-semibold">管理后台</h1>
            <p className="mt-1 text-xs text-muted-foreground">{admin.email}</p>
          </div>
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add dashboard page**

Create `src/app/admin/page.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getAdminDashboard } from "@/server/admin/admin-dashboard-service";

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboard();
  const stats = [
    ["知识项", dashboard.knowledgeItemCount],
    ["复习题", dashboard.reviewItemCount],
    ["知识关系", dashboard.relationCount],
    ["变量", dashboard.variableCount],
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">内容总览</h2>
          <p className="text-sm text-muted-foreground">维护知识库内容和 AI 导入记录。</p>
        </div>
        <Link href="/admin/import" className={buttonVariants()}>
          AI 导入
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-background p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border bg-background">
        <div className="border-b p-4">
          <h3 className="font-medium">最近导入</h3>
        </div>
        <div className="divide-y">
          {dashboard.recentImportRuns.map((run) => (
            <div key={run.id} className="flex items-center justify-between gap-4 p-4 text-sm">
              <span>{run.sourceTitle ?? run.defaultDomain}</span>
              <span className="text-muted-foreground">{run.status} · {run.savedCount}/{run.generatedCount}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Add import page and form**

Create `src/app/admin/import/page.tsx`:

```tsx
import { AdminImportForm } from "@/components/admin/admin-import-form";

export default function AdminImportPage() {
  return (
    <div className="grid gap-6">
      <header>
        <h2 className="text-2xl font-semibold">AI 导入</h2>
        <p className="text-sm text-muted-foreground">
          粘贴素材后自动拆分知识项、复习题、变量和关系，通过校验后批量保存。
        </p>
      </header>
      <AdminImportForm />
    </div>
  );
}
```

Create `src/components/admin/admin-import-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AdminImportForm() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setResult(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMaterial: formData.get("sourceMaterial"),
          sourceTitle: formData.get("sourceTitle"),
          defaultDomain: formData.get("defaultDomain"),
          defaultSubdomain: formData.get("defaultSubdomain"),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "导入失败");
        return;
      }

      setResult(JSON.stringify(payload.data, null, 2));
    });
  }

  return (
    <form action={submit} className="grid gap-4 rounded-lg border bg-background p-4">
      <div className="grid gap-2">
        <Label htmlFor="sourceTitle">来源标题</Label>
        <Input id="sourceTitle" name="sourceTitle" />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="defaultDomain">默认领域</Label>
          <Input id="defaultDomain" name="defaultDomain" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultSubdomain">默认子领域</Label>
          <Input id="defaultSubdomain" name="defaultSubdomain" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sourceMaterial">素材</Label>
        <Textarea id="sourceMaterial" name="sourceMaterial" required className="min-h-64" />
      </div>
      {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {result ? <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">{result}</pre> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "处理中..." : "生成并保存"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Add knowledge item list page**

Create `src/app/admin/knowledge-items/page.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
} from "@/server/admin/admin-knowledge-item-service";

export default async function AdminKnowledgeItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }
  const items = await listAdminKnowledgeItems(
    normalizeAdminKnowledgeItemSearchParams(params),
  );

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">知识项</h2>
          <p className="text-sm text-muted-foreground">搜索、检查和编辑内容条目。</p>
        </div>
        <Link href="/admin/knowledge-items/new" className={buttonVariants()}>
          新建知识项
        </Link>
      </header>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3">标题</th>
              <th className="p-3">类型</th>
              <th className="p-3">领域</th>
              <th className="p-3">难度</th>
              <th className="p-3">内容</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-3">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.slug}</div>
                </td>
                <td className="p-3">{item.contentType}</td>
                <td className="p-3">{item.domain}</td>
                <td className="p-3">{item.difficulty}</td>
                <td className="p-3 text-muted-foreground">
                  {item._count.reviewItems} 题 · {item._count.variables} 变量 · {item._count.outgoingRelations} 关系
                </td>
                <td className="p-3 text-right">
                  <Link href={`/admin/knowledge-items/${item.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    编辑
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run tests and lint**

Run:

```bash
npm run test -- tests/unit/admin-ui-copy.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin src/components/admin tests/unit/admin-ui-copy.test.ts
git commit -m "feat: add admin backstage ui"
```

## Task 9: Knowledge Item Form Pages

**Files:**
- Create: `src/components/admin/knowledge-item-admin-form.tsx`
- Create: `src/app/admin/knowledge-items/new/page.tsx`
- Create: `src/app/admin/knowledge-items/[id]/edit/page.tsx`
- Extend: `src/server/admin/admin-knowledge-item-service.ts`
- Extend: `src/app/api/admin/knowledge-items/route.ts`
- Extend: `src/app/api/admin/knowledge-items/[id]/route.ts`
- Test: `tests/unit/admin-knowledge-item-form.test.ts`

- [ ] **Step 1: Write form/API smoke test**

Create `tests/unit/admin-knowledge-item-form.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("admin knowledge item form", () => {
  it("includes aggregate editing sections and save routes", () => {
    const form = readFileSync("src/components/admin/knowledge-item-admin-form.tsx", "utf8");
    const collectionRoute = readFileSync("src/app/api/admin/knowledge-items/route.ts", "utf8");
    const itemRoute = readFileSync("src/app/api/admin/knowledge-items/[id]/route.ts", "utf8");

    assert.match(form, /基础信息/);
    assert.match(form, /复习题/);
    assert.match(form, /变量/);
    assert.match(form, /知识关系/);
    assert.match(collectionRoute, /export async function POST/);
    assert.match(itemRoute, /export async function PUT/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/admin-knowledge-item-form.test.ts`

Expected: FAIL because form pages and save routes do not exist.

- [ ] **Step 3: Add save service methods**

Extend `src/server/admin/admin-knowledge-item-service.ts` with:

```ts
import {
  normalizeAdminImportBatch,
  validateAdminImportBatch,
} from "@/server/admin/admin-import-validation";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";
import { saveAdminImportBatch } from "@/server/admin/admin-import-repository";

export function normalizeAdminKnowledgeItemFormInput(input: unknown): AdminImportBatch {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return normalizeAdminImportBatch({
    defaultDomain: String(record.domain ?? ""),
    items: [record as AdminImportBatch["items"][number]],
    relations: Array.isArray(record.relations)
      ? (record.relations as AdminImportBatch["relations"])
      : [],
  });
}

export async function saveAdminKnowledgeItemAggregate({
  adminUserId,
  input,
}: {
  adminUserId: string;
  input: unknown;
}) {
  const batch = normalizeAdminKnowledgeItemFormInput(input);
  const existingSlugs = new Set(
    (
      await prisma.knowledgeItem.findMany({
        where: { slug: { in: batch.relations.map((relation) => relation.toSlug) } },
        select: { slug: true },
      })
    ).map((item) => item.slug),
  );
  const validation = validateAdminImportBatch(batch, existingSlugs);

  if (!validation.ok) {
    return { ok: false as const, errors: validation.errors };
  }

  const importRun = await saveAdminImportBatch({
    adminUserId,
    sourceExcerpt: "Manual admin form save",
    batch: validation.batch,
    aiOutput: validation.batch,
  });

  return { ok: true as const, importRun };
}
```

- [ ] **Step 4: Add POST and PUT API handlers**

Extend `src/app/api/admin/knowledge-items/route.ts`:

```ts
import { saveAdminKnowledgeItemAggregate } from "@/server/admin/admin-knowledge-item-service";

export async function POST(request: Request) {
  return withAdminApi(async (admin) => {
    const result = await saveAdminKnowledgeItemAggregate({
      adminUserId: admin.id,
      input: await request.json(),
    });

    if (!result.ok) {
      return NextResponse.json({ error: "校验失败", errors: result.errors }, { status: 400 });
    }

    return NextResponse.json({ data: result.importRun });
  });
}
```

Extend `src/app/api/admin/knowledge-items/[id]/route.ts`:

```ts
import { saveAdminKnowledgeItemAggregate } from "@/server/admin/admin-knowledge-item-service";

export async function PUT(request: Request) {
  return withAdminApi(async (admin) => {
    const result = await saveAdminKnowledgeItemAggregate({
      adminUserId: admin.id,
      input: await request.json(),
    });

    if (!result.ok) {
      return NextResponse.json({ error: "校验失败", errors: result.errors }, { status: 400 });
    }

    return NextResponse.json({ data: result.importRun });
  });
}
```

- [ ] **Step 5: Add form component**

Create `src/components/admin/knowledge-item-admin-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const arrayFields = [
  "useConditions",
  "nonUseConditions",
  "antiPatterns",
  "typicalProblems",
  "examples",
  "tags",
] as const;

export function KnowledgeItemAdminForm({
  initialValue,
  endpoint,
  method,
}: {
  initialValue?: Record<string, unknown>;
  endpoint: string;
  method: "POST" | "PUT";
}) {
  const initial = createInitialItem(initialValue);
  const [contentType, setContentType] = useState(String(initial.contentType));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const requestPayload = buildPayload(formData, contentType);
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const payload = await response.json();
      setMessage(response.ok ? "已保存" : JSON.stringify(payload, null, 2));
    });
  }

  return (
    <form action={save} className="grid gap-4 rounded-lg border bg-background p-4">
      <section className="grid gap-2">
        <h3 className="font-medium">基础信息</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="slug" label="slug" defaultValue={String(initial.slug)} required />
          <Field name="title" label="标题" defaultValue={String(initial.title)} required />
          <Field name="domain" label="领域" defaultValue={String(initial.domain)} required />
          <Field name="subdomain" label="子领域" defaultValue={String(initial.subdomain)} />
          <Field name="difficulty" label="难度" defaultValue={String(initial.difficulty)} required />
          <label className="grid gap-2 text-sm">
            <span className="font-medium">内容类型</span>
            <select
              name="contentType"
              value={contentType}
              onChange={(event) => setContentType(event.target.value)}
              className="h-9 rounded-lg border bg-background px-3"
            >
              <option value="plain_text">plain_text</option>
              <option value="math_formula">math_formula</option>
              <option value="vocabulary">vocabulary</option>
            </select>
          </label>
        </div>
        <TextField name="summary" label="摘要" defaultValue={String(initial.summary)} required />
        <TextField name="body" label="正文" defaultValue={String(initial.body)} required />
        <TextField name="intuition" label="直觉解释" defaultValue={String(initial.intuition)} />
        <TextField name="deepDive" label="深入说明" defaultValue={String(initial.deepDive)} />
      </section>

      <section className="grid gap-2">
        <h3 className="font-medium">类型化内容</h3>
        {contentType === "math_formula" ? (
          <Field name="latex" label="LaTeX" defaultValue={String((initial.renderPayload as { latex?: string }).latex ?? "")} required />
        ) : contentType === "vocabulary" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field name="term" label="词条" defaultValue={String((initial.renderPayload as { term?: string }).term ?? "")} required />
            <Field name="definition" label="释义" defaultValue={String((initial.renderPayload as { definition?: string }).definition ?? "")} required />
            <Field name="phonetic" label="音标" defaultValue={String((initial.renderPayload as { phonetic?: string }).phonetic ?? "")} />
            <Field name="partOfSpeech" label="词性" defaultValue={String((initial.renderPayload as { partOfSpeech?: string }).partOfSpeech ?? "")} />
          </div>
        ) : (
          <TextField name="plainText" label="纯文本内容" defaultValue={String((initial.renderPayload as { text?: string }).text ?? "")} required />
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="font-medium">数组字段</h3>
        {arrayFields.map((field) => (
          <TextField
            key={field}
            name={field}
            label={field}
            defaultValue={(initial[field] as string[]).join("\n")}
          />
        ))}
      </section>

      <section className="grid gap-3">
        <h3 className="font-medium">变量</h3>
        <TextField
          name="variablesText"
          label="每行一个变量：symbol | name | description | unit"
          defaultValue={(initial.variables as Array<Record<string, unknown>>)
            .map((variable) => `${variable.symbol ?? ""} | ${variable.name ?? ""} | ${variable.description ?? ""} | ${variable.unit ?? ""}`)
            .join("\n")}
        />
      </section>

      <section className="grid gap-3">
        <h3 className="font-medium">复习题</h3>
        <TextField
          name="reviewItemsText"
          label="每行一道题：type | prompt | answer | explanation | difficulty"
          defaultValue={(initial.reviewItems as Array<Record<string, unknown>>)
            .map((item) => `${item.type ?? "recall"} | ${item.prompt ?? ""} | ${item.answer ?? ""} | ${item.explanation ?? ""} | ${item.difficulty ?? 1}`)
            .join("\n")}
        />
      </section>

      <section className="grid gap-3">
        <h3 className="font-medium">知识关系</h3>
        <TextField
          name="relationsText"
          label="每行一个关系：toSlug | relationType | note"
          defaultValue={(initial.relations as Array<Record<string, unknown>>)
            .map((relation) => `${relation.toSlug ?? ""} | ${relation.relationType ?? "related"} | ${relation.note ?? ""}`)
            .join("\n")}
        />
      </section>

      {message ? <pre className="rounded-lg border bg-muted/40 p-3 text-xs">{message}</pre> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "保存中..." : "保存"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input name={name} defaultValue={defaultValue} required={required} />
    </label>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <Textarea name={name} defaultValue={defaultValue} required={required} />
    </label>
  );
}

function createInitialItem(initialValue?: Record<string, unknown>) {
  return {
    ...createEmptyItem(),
    ...initialValue,
  };
}

function createEmptyItem(): Record<string, unknown> {
  return {
    slug: "",
    title: "",
    contentType: "plain_text",
    renderPayload: { text: "" },
    domain: "",
    subdomain: "",
    summary: "",
    body: "",
    intuition: "",
    deepDive: "",
    useConditions: [],
    nonUseConditions: [],
    antiPatterns: [],
    typicalProblems: [],
    examples: [],
    difficulty: 1,
    tags: [],
    variables: [],
    reviewItems: [],
    relations: [],
  };
}

function buildPayload(formData: FormData, contentType: string) {
  const slug = String(formData.get("slug") ?? "");
  return {
    slug,
    title: String(formData.get("title") ?? ""),
    contentType,
    renderPayload: buildRenderPayload(formData, contentType),
    domain: String(formData.get("domain") ?? ""),
    subdomain: String(formData.get("subdomain") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    body: String(formData.get("body") ?? ""),
    intuition: String(formData.get("intuition") ?? ""),
    deepDive: String(formData.get("deepDive") ?? ""),
    useConditions: lines(formData.get("useConditions")),
    nonUseConditions: lines(formData.get("nonUseConditions")),
    antiPatterns: lines(formData.get("antiPatterns")),
    typicalProblems: lines(formData.get("typicalProblems")),
    examples: lines(formData.get("examples")),
    difficulty: Number(formData.get("difficulty") ?? 1),
    tags: lines(formData.get("tags")),
    variables: lines(formData.get("variablesText")).map((line, index) => {
      const [symbol = "", name = "", description = "", unit = ""] = splitRow(line);
      return { symbol, name, description, unit, sortOrder: index };
    }),
    reviewItems: lines(formData.get("reviewItemsText")).map((line) => {
      const [type = "recall", prompt = "", answer = "", explanation = "", difficulty = "1"] = splitRow(line);
      return { type, prompt, answer, explanation, difficulty: Number(difficulty) };
    }),
    relations: lines(formData.get("relationsText")).map((line) => {
      const [toSlug = "", relationType = "related", note = ""] = splitRow(line);
      return { fromSlug: slug, toSlug, relationType, note };
    }),
  };
}

function buildRenderPayload(formData: FormData, contentType: string) {
  if (contentType === "math_formula") {
    return { latex: String(formData.get("latex") ?? "") };
  }

  if (contentType === "vocabulary") {
    return {
      term: String(formData.get("term") ?? ""),
      definition: String(formData.get("definition") ?? ""),
      phonetic: String(formData.get("phonetic") ?? ""),
      partOfSpeech: String(formData.get("partOfSpeech") ?? ""),
      examples: [],
    };
  }

  return { text: String(formData.get("plainText") ?? "") };
}

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitRow(line: string) {
  return line.split("|").map((part) => part.trim());
}
```

- [ ] **Step 6: Add form pages**

Create `src/app/admin/knowledge-items/new/page.tsx`:

```tsx
import { KnowledgeItemAdminForm } from "@/components/admin/knowledge-item-admin-form";

export default function NewAdminKnowledgeItemPage() {
  return (
    <div className="grid gap-4">
      <h2 className="text-2xl font-semibold">新建知识项</h2>
      <KnowledgeItemAdminForm endpoint="/api/admin/knowledge-items" method="POST" />
    </div>
  );
}
```

Create `src/app/admin/knowledge-items/[id]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { KnowledgeItemAdminForm } from "@/components/admin/knowledge-item-admin-form";
import { normalizeRouteParam } from "@/lib/route-params";
import { getAdminKnowledgeItem } from "@/server/admin/admin-knowledge-item-service";

export default async function EditAdminKnowledgeItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getAdminKnowledgeItem(normalizeRouteParam(id));

  if (!item) {
    notFound();
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-2xl font-semibold">编辑知识项</h2>
      <KnowledgeItemAdminForm
        initialValue={{
          ...item,
          relations: item.outgoingRelations.map((relation) => ({
            fromSlug: item.slug,
            toSlug: relation.toKnowledgeItem.slug,
            relationType: relation.relationType,
            note: relation.note ?? "",
          })),
        }}
        endpoint={`/api/admin/knowledge-items/${item.id}`}
        method="PUT"
      />
    </div>
  );
}
```

- [ ] **Step 7: Run tests and lint**

Run:

```bash
npm run test -- tests/unit/admin-knowledge-item-form.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/knowledge-item-admin-form.tsx src/app/admin/knowledge-items src/server/admin/admin-knowledge-item-service.ts src/app/api/admin/knowledge-items tests/unit/admin-knowledge-item-form.test.ts
git commit -m "feat: add admin knowledge item editing"
```

## Task 10: Final Verification

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test
npm run lint
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

Expected: Next.js starts and prints a localhost URL.

- [ ] **Step 3: Manually verify admin pages**

With a learner row set to `role = 'admin'`, open:

```text
http://localhost:3000/admin
http://localhost:3000/admin/import
http://localhost:3000/admin/knowledge-items
```

Expected:

- `/admin` shows counts and recent import runs.
- `/admin/import` accepts source material and, with `ADMIN_IMPORT_PROVIDER=mock`, saves one mock item.
- `/admin/knowledge-items` lists the saved mock item.

- [ ] **Step 4: Commit final fixes**

If Step 1 or Step 3 required fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize admin backstage"
```

If no fixes were required, do not create an empty commit.

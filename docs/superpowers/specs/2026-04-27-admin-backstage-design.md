# Admin Backstage Design

## Context

KnowledgeVault is a review-first learning tool built around structured
knowledge items, review items, diagnostics, memory hooks, and spaced review
state. The current product already has a generic `KnowledgeItem` model with
typed rendering for math formulas, vocabulary, and plain text.

The next step is an internal management backstage for the project owner. The
first version should focus on content maintenance and AI-assisted bulk import,
not public-facing operations, editor workflows, or advanced learning analytics.

The project is still in development. Database schema changes should update the
development baseline directly. No compatibility layers, compatibility branches,
or extra migration burden should be added.

## Goals

- Add an admin-only backstage under `/admin`.
- Use database roles to restrict access to admin users.
- Provide form-based content maintenance for knowledge items, variables, review
  items, and knowledge relations.
- Add an AI import workflow that accepts pasted source material, splits it into
  multiple knowledge items, generates all related content, validates the full
  batch, and writes it transactionally.
- On duplicate knowledge items, overwrite the existing content instead of
  creating versions or preserving legacy records.
- Make import failures explainable and easy to retry.

## Non-Goals

- No multi-person approval workflow.
- No draft review queue before saving AI output.
- No advanced user operations dashboard in the first version.
- No content versioning system.
- No partial-save import mode.
- No new Prisma migration file; update the development baseline directly.

## Recommended Approach

Build an AI-import-first admin backstage with supporting CRUD screens.

The primary workflow is:

```text
Admin opens /admin/import
-> pastes source material
-> chooses import defaults
-> submits "generate and save"
-> server asks AI for structured content
-> server validates the entire generated batch
-> if valid, server writes everything in one transaction
-> admin sees import summary
```

This keeps the first version fast for a single internal administrator while
still protecting the database from malformed partial imports. Manual editing is
available after import through normal form screens.

## Admin Access

Add a user role field to the `User` model:

```prisma
enum UserRole {
  learner
  admin
}

model User {
  role UserRole @default(learner)
}
```

Admin authorization rules:

- `/admin` pages require a signed-in learner whose `User.role` is `admin`.
- `/api/admin/*` routes also check the role server-side.
- Unauthorized authenticated users receive a 403 response.
- Anonymous users are redirected to the account/sign-in flow for pages and
  receive 401 from APIs.

The first admin can be assigned by seed data or a local database update during
development.

## Admin Pages

### `/admin`

Purpose: lightweight operational landing page.

Show:

- total knowledge item count
- total review item count
- total relation count
- total variable count
- recent AI import runs
- quick links to import and content list

This page is not a full analytics dashboard. It is a launchpad and health
summary for content maintenance.

### `/admin/import`

Purpose: AI-assisted bulk import from pasted material.

Inputs:

- source material text
- optional source title
- default domain
- optional default subdomain
- preferred content types, defaulting to all supported types
- import note for later traceability

Behavior:

- The submit action is "generate and save".
- AI output is not saved directly. The server normalizes and validates it first.
- If validation passes, the full batch is saved immediately in one transaction.
- If validation fails, nothing is saved and the page shows grouped errors.

### `/admin/knowledge-items`

Purpose: browse and find content.

Controls:

- keyword search across title, slug, summary, body, and tags
- domain filter
- content type filter
- difficulty filter
- tag filter

Rows show:

- title
- slug
- content type
- domain/subdomain
- difficulty
- review item count
- variable count
- relation count
- updated time

Actions:

- create item
- edit item
- delete item
- open public preview

### `/admin/knowledge-items/new`

Purpose: form-based creation for a single knowledge item.

The form includes:

- base fields: slug, title, content type, domain, subdomain, summary, body,
  intuition, deep dive, difficulty, tags
- array fields: use conditions, non-use conditions, anti-patterns, typical
  problems, examples
- typed render payload fields based on content type
- variables editor
- review items editor
- relation editor

### `/admin/knowledge-items/[id]/edit`

Purpose: form-based editing for an existing item.

The edit screen uses the same sections as creation. Saving replaces the item
aggregate in a transaction:

- update the knowledge item
- replace variables
- replace review items
- replace outgoing relations

The first version does not need inline autosave.

## AI Import Contract

The AI import service should produce a structured batch:

```ts
type AdminImportBatch = {
  sourceTitle?: string;
  defaultDomain: string;
  items: AdminImportedKnowledgeItem[];
  relations: AdminImportedRelation[];
};
```

Each imported item contains:

- stable slug
- title
- content type
- render payload
- domain
- subdomain
- summary
- body
- intuition
- deep dive
- use conditions
- non-use conditions
- anti-patterns
- typical problems
- examples
- difficulty
- tags
- variables
- review items

Each imported relation contains:

- from slug
- to slug
- relation type
- optional note

The service should ask the model for strict structured output and treat the
response as untrusted input until validation passes.

## Validation Rules

Batch-level validation:

- at least one item is generated
- slugs are unique inside the batch
- relation endpoints refer to generated items or existing database items
- no relation points from an item to itself
- no duplicate relation triplets in the final result

Knowledge item validation:

- slug is present and URL-safe
- title is present
- content type is one of the supported enum values
- render payload matches the selected content type
- domain is present
- summary and body are present
- difficulty is an integer from 1 to 5
- array fields are arrays of strings
- tags are normalized and deduplicated

Review item validation:

- each knowledge item has at least one review item
- review item type is one of `recall`, `recognition`, or `application`
- prompt and answer are present
- difficulty is an integer from 1 to 5

Variable validation:

- variable symbols are unique per knowledge item
- symbol and name are present
- sort order is deterministic

Relation validation:

- relation type is one of the supported enum values
- endpoint slugs resolve after duplicate overwrite behavior is applied

If any validation fails, the import writes nothing.

## Duplicate And Overwrite Behavior

Duplicate detection uses slug as the first version's identity key.

For each generated item:

- if the slug does not exist, create a new `KnowledgeItem`
- if the slug already exists, update the existing `KnowledgeItem`
- replace variables for that item
- replace review items for that item
- replace all outgoing relations whose source item is part of the generated
  batch; relations from items outside the batch are left unchanged

Existing user learning state, review logs, diagnostic attempts, study sessions,
and memory hooks should remain intact when an item is overwritten. Content
maintenance should not erase learner history.

## Import Records

Add an admin import run model for traceability:

```prisma
enum AdminImportStatus {
  validation_failed
  saved
  ai_failed
}

model AdminImportRun {
  id              String            @id @default(cuid())
  adminUserId     String
  sourceTitle     String?
  sourceExcerpt   String
  defaultDomain   String
  status          AdminImportStatus
  generatedCount  Int               @default(0)
  savedCount      Int               @default(0)
  validationErrors Json?
  aiOutput         Json?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  adminUser       User              @relation(fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId, createdAt])
  @@index([status, createdAt])
  @@map("admin_import_runs")
}
```

The source excerpt should store a bounded preview, not necessarily the full
source material. The first version can store AI output as JSON to make debugging
and retry decisions practical.

## Server Modules

Add admin-specific server code instead of mixing admin behavior into public
learning services:

- `src/server/admin/admin-auth.ts`
- `src/server/admin/admin-dashboard-service.ts`
- `src/server/admin/admin-knowledge-item-service.ts`
- `src/server/admin/admin-import-service.ts`
- `src/server/admin/admin-import-validation.ts`
- `src/server/admin/admin-import-repository.ts`

Public review, diagnostic, and knowledge item read services should remain
focused on learner-facing behavior.

## API Routes

Add:

- `GET /api/admin/dashboard`
- `GET /api/admin/knowledge-items`
- `POST /api/admin/knowledge-items`
- `GET /api/admin/knowledge-items/[id]`
- `PUT /api/admin/knowledge-items/[id]`
- `DELETE /api/admin/knowledge-items/[id]`
- `POST /api/admin/import`
- `GET /api/admin/import-runs`
- `GET /api/admin/import-runs/[id]`

Every route must call the shared admin authorization helper.

## UI Shape

The admin UI should be utilitarian and dense:

- left-side navigation for Dashboard, AI Import, Knowledge Items
- compact tables for lists
- sectioned forms for item editing
- inline validation messages near fields
- import result summary with saved items and validation error groups

Avoid marketing-style presentation. This is an internal tool for repeated
maintenance work.

## Error Handling

AI errors:

- show a plain failure message
- record an `ai_failed` import run when possible
- do not write content

Validation errors:

- group by item slug and relation
- show actionable messages
- record a `validation_failed` import run
- do not write content

Database errors:

- transaction rollback protects partial writes
- show a generic save failure in the UI
- log server details for development debugging

Authorization errors:

- pages redirect or show access denied
- APIs return 401 or 403 consistently

## Testing

Unit tests:

- admin role authorization helper
- AI import schema normalization
- validation rules
- duplicate slug overwrite planning
- relation endpoint resolution

Integration tests:

- admin import rejects invalid batches without writing records
- valid import creates new items, variables, review items, and relations
- duplicate import overwrites content while keeping learner state
- non-admin users cannot access admin APIs

E2E smoke test:

- admin can open `/admin/import`
- submit a mocked valid AI import
- see saved import summary
- find the imported items in `/admin/knowledge-items`

## Rollout Plan

1. Add admin role and import-run schema to Prisma baseline.
2. Add admin authorization helper.
3. Build import validation and transaction save service.
4. Add mocked AI import path for tests.
5. Add admin import page and API.
6. Add knowledge item list and form editing pages.
7. Add dashboard summary.

This order keeps the riskiest data-write path testable before the UI is fully
polished.

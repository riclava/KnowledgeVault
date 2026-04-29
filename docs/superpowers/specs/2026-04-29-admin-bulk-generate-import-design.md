# Admin Bulk Generate Import Design

## Context

The admin area already supports AI-assisted imports through a preview-and-confirm flow. That flow is best for pasted source material that the admin wants to inspect and edit before saving. The new workflow is different: an admin has a file where each non-empty line is a knowledge point title or short phrase, chooses one content type and one domain, and wants the system to generate and import those items without confirmation.

The project is still in active development, so this feature should target the intended behavior directly. No compatibility layer is needed for older import shapes.

## Goals

- Add a dedicated admin entry for batch generation imports.
- Let the admin choose a single `contentType`, domain, optional subdomain, and upload a text-like file.
- Treat each non-empty line as one knowledge point title or phrase.
- Generate exactly one knowledge item per line with AI.
- Force every generated item to use the selected content type, domain, and subdomain.
- Import successful rows immediately, without preview confirmation.
- Let failed rows, invalid rows, and suspected duplicates fail independently without blocking the rest of the batch.
- Persist batch run and row status on the backend so progress survives refreshes.
- Show real-time progress with row-level status, counts, and actionable error details.

## Non-Goals

- No manual preview or confirmation step in this workflow.
- No rollback of successful rows when later rows fail.
- No new Prisma migration. If schema changes become necessary, update the baseline directly.
- No support for spreadsheet parsing beyond simple line-based text in the initial implementation.

## Admin UX

Add a new admin page at `/admin/bulk-generate-import`, linked from the admin navigation as `批量生成导入`.

The page contains:

- A content type selector using the existing knowledge item content types:
  - `concept_card`
  - `procedure`
  - `comparison_table`
  - `math_formula`
  - `vocabulary`
  - `plain_text`
- A required domain input with existing-domain suggestions.
- An optional subdomain input with existing-subdomain suggestions.
- A file upload control.
- A submit button that creates a backend run and starts generation/import processing.

The page reads the selected file as text and sends the parsed lines to the server when creating the run. Empty lines are skipped. Each remaining line is displayed using its original 1-based line number.

After run creation, the page polls the backend for run progress. The progress panel shows:

- Total non-empty rows.
- Imported rows.
- Failed rows.
- Duplicate-skipped rows.
- Pending and processing rows.
- Overall run status.
- A row-level list with status, source line text, generated title or slug when available, and error or duplicate detail when applicable.

If the browser refreshes, an admin can reopen the run detail URL and continue watching the persisted backend state.

## API

Add dedicated admin-only endpoints:

### Create Run

`POST /api/admin/bulk-generate-import/runs`

Request shape:

```ts
type CreateAdminBulkGenerateImportRunRequest = {
  contentType: KnowledgeItemType;
  domain: string;
  subdomain?: string;
  lines: string[];
};
```

The endpoint validates:

- The caller is an admin.
- `contentType` is one of the known knowledge item types.
- `domain` is present.
- `lines` contains at least one non-empty item after trimming.
- The request does not exceed a conservative maximum row count.

The endpoint creates a persisted run plus one persisted row per non-empty input line. It returns:

```ts
type CreateAdminBulkGenerateImportRunResult = {
  runId: string;
};
```

### Read Run

`GET /api/admin/bulk-generate-import/runs/:id`

The endpoint returns persisted progress:

```ts
type AdminBulkGenerateImportRunDetail = {
  id: string;
  status: AdminBulkGenerateImportRunStatus;
  contentType: KnowledgeItemType;
  domain: string;
  subdomain?: string;
  totalCount: number;
  importedCount: number;
  failedCount: number;
  duplicateSkippedCount: number;
  pendingCount: number;
  processingCount: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  rows: AdminBulkGenerateImportRowResult[];
};
```

Each row result includes the original line index, original text, status, generated item details when available, duplicate details when available, and error details when applicable.

### Start Processing

`POST /api/admin/bulk-generate-import/runs/:id/process`

This endpoint enqueues or starts backend-owned processing for a pending run and returns quickly with HTTP 202. The processing implementation must update row and run state in the database as work progresses. The durable run/row model is the source of truth, and the frontend polls persisted progress instead of waiting on the process request.

The processing boundary is isolated behind a task processor interface. The production path uses a backend worker or queue-backed task runner. A local development fallback may run the same processor in-process, but the browser must never own row sequencing or row success decisions.

## Server Flow

Create a new admin service for this workflow, separate from the current preview import service. The service should reuse existing import validation, duplicate detection, and save behavior where practical.

Run creation:

1. Normalize and validate the request.
2. Create an `AdminBulkGenerateImportRun` with `pending` status and selected generation settings.
3. Create one `AdminBulkGenerateImportRow` per non-empty input line with `pending` status.
4. Return `runId`.

Processing:

1. Mark the run `running` and set `startedAt` when processing begins.
2. Load pending rows in line order.
3. For each pending row, mark it `processing`.
4. Build an AI generation input from the row text, selected content type, selected domain, and optional subdomain.
5. Ask AI to generate exactly one knowledge item in the existing admin import item shape.
6. Wrap that item in an `AdminImportBatch` with no relations.
7. Normalize and validate the batch.
8. Run existing public-knowledge duplicate detection.
9. If duplicate warnings exist, mark the row `duplicate_skipped` and save duplicate details.
10. If there are no duplicate warnings, save the batch immediately and mark the row `imported`.
11. If AI, validation, or persistence fails, mark only that row with the corresponding failure status and error details.
12. When no pending or processing rows remain, mark the run `completed` and set `completedAt`. If the processing loop itself crashes before it can classify a row, mark the run `failed` and store a run-level error.

Rows are processed independently. A row-level failure does not abort the whole import.

## AI Contract

Add an AI helper for one-line generation. It can reuse the existing structured output schema, but the prompt must be stricter than the general source-material import:

- The source line is a knowledge point title or short phrase, not a full article.
- Generate exactly one item.
- Use the admin-selected content type exactly.
- Use the admin-selected domain exactly.
- Use the admin-selected subdomain exactly when provided.
- Do not create relations.
- Keep Chinese as the main language for explanations, review items, examples, tags, and notes.
- Generate useful review items and render payload for the selected content type.

The mock provider should produce deterministic one-item batches for local tests and UI development.

## Duplicate Handling

Because this workflow has no confirmation step, suspected duplicates are skipped by default. The row report should show:

- Generated title and slug when available.
- Existing item title and slug.
- Similarity score.
- Similarity reasons.

This prevents silent pollution of the public knowledge base while preserving the non-blocking batch behavior.

## Persistence

Use the existing knowledge item, variable, review item, and import-run persistence paths where possible.

Add baseline Prisma models for the durable batch workflow:

```prisma
enum AdminBulkGenerateImportRunStatus {
  pending
  running
  completed
  failed
  canceled
}

enum AdminBulkGenerateImportRowStatus {
  pending
  processing
  imported
  duplicate_skipped
  ai_failed
  validation_failed
  save_failed
  canceled
}

model AdminBulkGenerateImportRun {
  id                    String                           @id @default(cuid())
  adminUserId           String
  contentType           KnowledgeItemType
  domain                String
  subdomain             String?
  status                AdminBulkGenerateImportRunStatus @default(pending)
  totalCount            Int
  importedCount         Int                              @default(0)
  failedCount           Int                              @default(0)
  duplicateSkippedCount Int                              @default(0)
  errorMessage          String?
  startedAt             DateTime?
  completedAt           DateTime?
  createdAt             DateTime                         @default(now())
  updatedAt             DateTime                         @updatedAt

  adminUser User                         @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  rows      AdminBulkGenerateImportRow[]

  @@index([adminUserId, createdAt])
  @@index([status, createdAt])
  @@map("admin_bulk_generate_import_runs")
}

model AdminBulkGenerateImportRow {
  id                   String                           @id @default(cuid())
  runId                String
  lineNumber           Int
  sourceText           String
  status               AdminBulkGenerateImportRowStatus @default(pending)
  generatedSlug        String?
  generatedTitle       String?
  savedKnowledgeItemId String?
  duplicateWarnings    Json?
  validationErrors     Json?
  errorMessage         String?
  aiOutput             Json?
  startedAt            DateTime?
  completedAt          DateTime?
  createdAt            DateTime                         @default(now())
  updatedAt            DateTime                         @updatedAt

  run AdminBulkGenerateImportRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([runId, lineNumber])
  @@index([runId, status])
  @@map("admin_bulk_generate_import_rows")
}
```

Update the baseline migration SQL directly to match these Prisma baseline schema changes.

Each successfully imported row is saved through the existing import batch saving function. The row stores the saved knowledge item id or generated slug/title so the report can link back to the imported item. Row-level failures are durable and can be inspected after refresh.

The existing `AdminImportRun` continues to be created by the reused save path for each successful one-item batch. The new bulk run and rows are the source of truth for bulk progress.

## Error Handling

Run-level statuses:

- `pending`: the run has been created but processing has not started.
- `running`: at least one row is pending or processing.
- `completed`: all rows reached a terminal row status.
- `failed`: the processing loop failed outside a row-level failure boundary.

Row-level statuses:

- `pending`: the row is waiting to be processed.
- `processing`: the row is currently being generated, checked, or saved.
- `imported`: the row generated, validated, passed duplicate checks, and saved.
- `duplicate_skipped`: the row generated and validated, but duplicate detection found public matches.
- `ai_failed`: the AI call failed or returned unusable output.
- `validation_failed`: generated output did not pass import validation.
- `save_failed`: persistence failed after validation.

Create and process APIs should return HTTP 400 only for invalid request-level inputs. Row-level failures are represented in persisted row state and returned by the run detail endpoint.

## Testing

Unit tests should cover:

- Request normalization trims lines and drops empty rows.
- Missing domain, missing lines, and invalid content type are rejected.
- AI generation request forces selected content type and domain.
- Creating a run persists one row per non-empty input line.
- Processing moves rows through `pending`, `processing`, and terminal statuses.
- A validation failure on one row does not prevent another row from importing.
- Duplicate warnings skip a row instead of saving it.
- Run summary counts match row statuses.
- Re-reading a run returns durable row progress after processing has started.
- The admin route requires admin access through existing admin API helpers.

UI tests or copy tests should cover:

- The admin navigation exposes `批量生成导入`.
- The page contains content type, domain, subdomain, file upload, progress, and result report copy.
- The page polls run detail after creating a run and updates row status without waiting for all rows to complete.

## Implementation Decisions

- The first version accepts at most 10000 non-empty rows per request while still using backend-owned progress state.
- Initial file support is UTF-8 text content. CSV files are accepted as plain text, where each line is treated as the source phrase after trimming.
- The implementation uses a database-backed task model plus a backend worker or queue-backed task runner for deployed environments. The process endpoint only starts or enqueues work and returns quickly.
- The frontend never decides row success or failure. It only creates runs, starts processing, polls persisted state, and renders progress.

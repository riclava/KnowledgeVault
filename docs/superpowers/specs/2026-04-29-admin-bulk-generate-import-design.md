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
- Show a row-level report with counts and actionable error details.

## Non-Goals

- No manual preview or confirmation step in this workflow.
- No rollback of successful rows when later rows fail.
- No new Prisma migration. If schema changes become necessary, update the baseline directly.
- No support for spreadsheet parsing beyond simple line-based text in the initial implementation.
- No background job queue in the initial implementation.

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
- A submit button that starts generation and import.

The page reads the selected file as text and sends the parsed request to the server. Empty lines are skipped. Each remaining line is displayed in the final result report using its original 1-based line number.

The result panel shows:

- Total non-empty rows.
- Imported rows.
- Failed rows.
- Duplicate-skipped rows.
- A row-level list with status, source line text, generated title or slug when available, and error or duplicate detail when applicable.

## API

Add a dedicated admin-only endpoint:

`POST /api/admin/bulk-generate-import`

Request shape:

```ts
type AdminBulkGenerateImportRequest = {
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

The endpoint returns one batch result rather than throwing for row-level failures:

```ts
type AdminBulkGenerateImportResult = {
  totalCount: number;
  importedCount: number;
  failedCount: number;
  duplicateSkippedCount: number;
  rows: AdminBulkGenerateImportRowResult[];
};
```

Each row result includes the original line index, original text, status, and details.

## Server Flow

Create a new admin service for this workflow, separate from the current preview import service. The service should reuse existing import validation, duplicate detection, and save behavior where practical.

For each normalized line:

1. Build an AI generation input from the line text, selected content type, selected domain, and optional subdomain.
2. Ask AI to generate exactly one knowledge item in the existing admin import item shape.
3. Wrap that item in an `AdminImportBatch` with no relations.
4. Normalize and validate the batch.
5. Run existing public-knowledge duplicate detection.
6. If duplicate warnings exist, skip the row and record duplicate details.
7. If there are no duplicate warnings, save the batch immediately.
8. Record success or row-level failure.

Rows are processed independently. A failure in one row does not abort the whole import.

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

Each successfully imported row is saved through the existing import batch saving function. The initial implementation creates one `AdminImportRun` per successful row, because the existing run model naturally represents one generated batch and avoids schema changes. Row-level failures are returned to the caller in the response and do not need durable storage in the first version.

If a durable aggregate batch record becomes necessary later, update the baseline schema directly instead of adding a migration.

## Error Handling

Row-level statuses:

- `imported`: the row generated, validated, passed duplicate checks, and saved.
- `duplicate_skipped`: the row generated and validated, but duplicate detection found public matches.
- `ai_failed`: the AI call failed or returned unusable output.
- `validation_failed`: generated output did not pass import validation.
- `save_failed`: persistence failed after validation.

The API should return HTTP 200 when the request itself is valid, even if some or all rows fail. It should return HTTP 400 only for invalid request-level inputs.

## Testing

Unit tests should cover:

- Request normalization trims lines and drops empty rows.
- Missing domain, missing lines, and invalid content type are rejected.
- AI generation request forces selected content type and domain.
- A validation failure on one row does not prevent another row from importing.
- Duplicate warnings skip a row instead of saving it.
- Result counts match row statuses.
- The admin route requires admin access through existing admin API helpers.

UI tests or copy tests should cover:

- The admin navigation exposes `批量生成导入`.
- The page contains content type, domain, subdomain, file upload, and result report copy.

## Implementation Decisions

- The first version accepts at most 50 non-empty rows per request. This keeps synchronous API execution and AI cost manageable.
- Initial file support is UTF-8 text content. CSV files are accepted as plain text, where each line is treated as the source phrase after trimming.

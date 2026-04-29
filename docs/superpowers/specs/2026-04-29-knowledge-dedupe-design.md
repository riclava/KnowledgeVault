# Knowledge Dedupe Design

## Goal

Add a periodic, manual dedupe workflow for the public knowledge base. An admin
can choose a domain, scan existing public knowledge items for duplicates, review
candidate groups, and merge confirmed duplicates while preserving learning
history.

This is an admin maintenance tool for existing public content. It is not an
automatic import blocker, not a scheduler, and not a private user knowledge
cleanup flow.

## Current Context

KnowledgeVault stores structured knowledge in `KnowledgeItem` with variables,
active review items, knowledge relations, review logs, user knowledge state,
memory hooks, and diagnostic attempt references. Knowledge items can be public
or private. This dedupe feature only operates on `visibility = public` items.

The project is still in development. Database schema changes should update the
development baseline directly. No new migration file, compatibility branch, or
legacy migration path should be added.

## Recommended Approach

Use a hybrid scan:

1. Local rules find likely duplicate pairs within a selected domain and optional
   subdomain.
2. Pairs are clustered into candidate groups.
3. Existing OpenAI-compatible AI can optionally review candidate groups and add
   semantic judgment, reasons, and a suggested canonical item.
4. Admins manually confirm merge or ignore each group.

AI improves explanation and ranking, but it never executes a merge. The merge is
always an explicit admin action.

## Admin Workflow

Add `/admin/dedupe` as a backstage maintenance page.

The page includes:

- scan form: domain, optional subdomain, threshold, and AI review toggle
- recent dedupe runs
- run detail view with candidate groups
- candidate comparison view
- merge confirmation sheet

The flow:

```text
Admin opens /admin/dedupe
-> chooses a domain and optional subdomain
-> starts a scan
-> reviews candidate groups
-> chooses one canonical knowledge item per duplicate group
-> confirms merge
-> system migrates and merges dependent data transactionally
-> candidate is marked merged
```

Each candidate group shows:

- title, slug, content type, domain, subdomain, difficulty, and updated time
- summary and body excerpts
- active review item count, variable count, relation count
- learning-data impact counts for user states, review logs, and memory hooks
- local similarity reasons
- AI judgment and suggested canonical item when AI review was enabled

Candidates can be marked ignored for the current run. Ignoring does not create a
global ignore rule in the first version.

## Data Model

Add enums:

```prisma
enum KnowledgeDedupeRunStatus {
  running
  completed
  failed
}

enum KnowledgeDedupeCandidateStatus {
  pending
  merged
  ignored
  stale
}
```

Add models:

```prisma
model KnowledgeDedupeRun {
  id              String                   @id @default(cuid())
  adminUserId     String
  domain          String
  subdomain       String?
  threshold       Float
  usedAiReview    Boolean                  @default(false)
  status          KnowledgeDedupeRunStatus @default(running)
  candidateCount  Int                      @default(0)
  warningMessage  String?
  errorMessage    String?
  startedAt       DateTime                 @default(now())
  completedAt     DateTime?
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  adminUser  User                       @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  candidates KnowledgeDedupeCandidate[]

  @@index([domain, subdomain])
  @@index([adminUserId, createdAt])
  @@map("knowledge_dedupe_runs")
}

model KnowledgeDedupeCandidate {
  id                         String                         @id @default(cuid())
  runId                      String
  knowledgeItemIds           String[]
  localScore                 Float
  localReasons               Json
  aiScore                    Float?
  aiRecommendation           Json?
  warningMessage             String?
  suggestedCanonicalItemId    String?
  status                     KnowledgeDedupeCandidateStatus @default(pending)
  mergedIntoKnowledgeItemId   String?
  mergedKnowledgeItemIds      String[]
  ignoredReason              String?
  createdAt                  DateTime                       @default(now())
  updatedAt                  DateTime                       @updatedAt

  run KnowledgeDedupeRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId, status])
  @@map("knowledge_dedupe_candidates")
}
```

The candidate stores item IDs as arrays because each group is a snapshot of a
scan result. Merge-time validation checks that those items still exist and are
still public before changing data. If not, the candidate becomes `stale`.

## Local Similarity Scan

The scanner only reads `KnowledgeItem` rows where:

- `visibility = public`
- `domain = selected domain`
- `subdomain = selected subdomain`, when provided

Local scoring uses deterministic features:

- normalized title similarity
- slug token overlap
- summary and body token similarity
- tags, use conditions, typical problems, and examples overlap
- matching content type as a positive signal

The scanner produces pair scores and local reason objects. Pairs above the
threshold are clustered into groups using connected components. This lets
`A ~ B` and `B ~ C` become one reviewable candidate group.

## AI Review

When enabled, AI receives only candidate groups produced by local rules. It does
not receive every possible item pair in the domain.

AI returns:

- whether the group is likely duplicate, related, prerequisite, or merely
  similar
- confidence score
- duplicate reasoning
- suggested canonical knowledge item
- merge cautions, such as conflicting definitions or cases where a relation is
  better than a merge

If AI fails, the run completes with local candidates and stores a warning on the
run or candidate. AI failure must not block local dedupe.

## Merge Semantics

Merging is transactional. The admin chooses one canonical item and one or more
duplicate items from the candidate group. The duplicate items disappear after
their dependent data is migrated or merged.

The canonical knowledge item remains the primary record. First version does not
ask AI to rewrite the canonical body, summary, or render payload.

The merge may enrich simple array fields on the canonical item:

- `tags`
- `examples`
- `useConditions`
- `nonUseConditions`
- `antiPatterns`
- `typicalProblems`

Values are appended and deduped while preserving canonical item values first.

Variable merge is conservative:

- variables with new symbols are moved to the canonical item
- conflicting symbols keep the canonical variable

Review item merge:

- every duplicate review item with review logs is moved to the canonical item so
  historical logs keep a valid `reviewItemId`
- active duplicate review items without review logs are moved when their prompt
  is not already present on the canonical item
- active duplicate review items without review logs and with duplicate prompts
  are deleted
- archived duplicate review items without review logs are deleted
- moved duplicate review items keep their `isActive` value

Relation merge:

- incoming relations to duplicate items are redirected to the canonical item
- outgoing relations from duplicate items are redirected from the canonical item
- self-relations created by the merge are deleted
- relation rows that would violate the unique relation constraint are resolved
  by keeping the existing canonical relation and deleting the duplicate relation

Review log merge:

- `ReviewLog.knowledgeItemId` is updated to the canonical item

User knowledge state merge:

- if a user only has state on a duplicate item, move it to the canonical item
- if a user has state on both, merge into the canonical state:
  - `lastReviewedAt`: newer value
  - `nextReviewAt`: earlier non-null value
  - `totalReviews`, `correctReviews`, `lapseCount`: summed values
  - `consecutiveCorrect`: max value
  - `memoryStrength`, `stability`, `difficultyEstimate`: prefer the state with
    the newer `lastReviewedAt`; if neither was reviewed, keep the canonical
    value

Memory hook merge:

- if a user only has a hook on a duplicate item, move it to the canonical item
- if a user has hooks on both, keep the canonical hook and append the duplicate
  hook content with clear separation, then delete the duplicate hook
- review logs that referenced the duplicate hook are redirected to the canonical
  hook when hooks are merged

Diagnostic attempt merge:

- replace duplicate item IDs in `DiagnosticAttempt.weakKnowledgeItemIds` with
  the canonical item ID
- dedupe the resulting ID arrays

After dependent data is migrated, duplicate knowledge items are deleted.

## API Surface

All endpoints require admin authorization.

- `GET /api/admin/dedupe/runs`
  Lists recent dedupe runs.
- `POST /api/admin/dedupe/runs`
  Starts a scan. Input: `domain`, optional `subdomain`, `threshold`, and
  `useAiReview`.
- `GET /api/admin/dedupe/runs/[id]`
  Returns run details and candidate groups.
- `POST /api/admin/dedupe/candidates/[id]/ignore`
  Marks a pending candidate ignored for this run.
- `POST /api/admin/dedupe/candidates/[id]/merge`
  Executes a merge. Input: `canonicalKnowledgeItemId` and
  `mergedKnowledgeItemIds`.

## Service Boundaries

Add focused server modules:

- `src/server/admin/admin-knowledge-dedupe-scan-service.ts`
  Orchestrates scan runs, local scoring, clustering, and optional AI review.
- `src/server/admin/admin-knowledge-dedupe-merge-service.ts`
  Performs merge validation and transactional data migration.
- `src/server/admin/admin-knowledge-dedupe-repository.ts`
  Persists runs and candidates.
- `src/server/admin/knowledge-dedupe-similarity.ts`
  Contains pure local scoring functions.

This keeps deterministic scoring and merge rules easy to unit test without
loading admin page code.

## Error Handling

Scan errors:

- invalid domain or empty result returns a completed run with zero candidates
- AI failure records a warning and falls back to local candidates
- unexpected scan failure marks the run `failed` with an error message

Merge errors:

- non-pending candidates cannot be merged
- missing or private knowledge items make the candidate `stale`
- canonical item must be one of the candidate items
- merged item IDs must be a non-empty subset of the candidate group
- transaction conflicts return a readable failure and leave data unchanged

## Tests

Add tests for:

- local similarity detects obvious duplicates within a domain
- scan never crosses domain boundaries
- scan only includes public knowledge items
- pair candidates cluster into groups
- AI failure does not block local scan results
- merge redirects incoming and outgoing relations
- merge removes self-relations and duplicate relation rows
- merge combines `UserKnowledgeItemState` without unique constraint conflicts
- merge combines or moves `KnowledgeItemMemoryHook`
- merge updates `ReviewLog.knowledgeItemId`
- merge updates `DiagnosticAttempt.weakKnowledgeItemIds`
- duplicate knowledge items are deleted after merge
- stale or already processed candidates cannot be merged

## Out of Scope

- automatic scheduled scans
- automatic merge execution
- private user knowledge dedupe
- global ignore rules
- content version history
- AI-generated canonical content rewriting
- compatibility migrations for historical production data

## Implementation Order

1. Add pure similarity functions and tests.
2. Add Prisma schema and baseline SQL changes.
3. Add dedupe run and candidate repository.
4. Add scan service and scan APIs.
5. Add merge service and transaction tests.
6. Add `/admin/dedupe` page and admin navigation entry.
7. Add optional AI review.
8. Run unit tests and manually verify one admin dedupe flow.

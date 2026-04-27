# Knowledge Items Thorough Redesign

## Context

FormulaLab is currently centered on math formulas. The `Formula` model, `/formulas`
routes, API payloads, review queues, diagnostics, stats, memory hooks, and UI copy
all assume that the trained object is a formula with a LaTeX expression.

The product now needs to support multiple knowledge item types inside each
learning domain: math formulas, vocabulary words, and plain text. Types should
only affect rendering and type-specific authoring fields. Review, diagnostics,
stats, memory hooks, scheduling, relations, and domain filtering should work on
all knowledge items through one shared model.

The project is still in development. We will make a thorough breaking redesign:
no compatibility layer, no legacy `/formulas` API contract, and no migration
burden. Database changes must update the baseline migration directly.

## Goals

- Replace the core Formula concept with KnowledgeItem across database, server,
  API, TypeScript types, routes, components, tests, and user-facing copy.
- Allow each learning domain to contain mixed item types.
- Add renderer plugins so each item type owns only its display behavior.
- Keep review-first behavior intact: diagnostics, today review, weak review,
  memory hooks, stats, and learning paths continue to operate on knowledge
  items.
- Support at least three initial content types:
  - `math_formula`
  - `vocabulary`
  - `plain_text`

## Non-Goals

- No backwards-compatible `/formulas` routes or aliases.
- No migration files beyond modifying the existing development baseline.
- No generalized third-party plugin runtime or dynamic code loading.
- No separate table per content type.
- No attempt to preserve existing local seed data IDs.

## Recommended Architecture

Use one shared `KnowledgeItem` aggregate with a `contentType` discriminator and a
JSON `renderPayload`. Rendering is delegated to a client-side registry of
renderer plugins keyed by `contentType`.

This keeps learning workflows generic while letting each content type provide its
own visual treatment. The database and services remain simple: most workflows do
not care whether an item is a formula, word, or text note.

## Data Model

Rename and reshape the current formula-centered models:

- `Formula` -> `KnowledgeItem`
- `FormulaVariable` -> `KnowledgeItemVariable`
- `FormulaRelation` -> `KnowledgeItemRelation`
- `UserFormulaState` -> `UserKnowledgeItemState`
- `FormulaMemoryHook` -> `KnowledgeItemMemoryHook`

Rename formula IDs in related models:

- `formulaId` -> `knowledgeItemId`
- `weakFormulaIds` -> `weakKnowledgeItemIds`
- product event names should become item-oriented, for example
  `weak_item_impression` and `weak_item_opened`.

Add an enum:

```prisma
enum KnowledgeItemType {
  math_formula
  vocabulary
  plain_text
}
```

The core model should become:

```prisma
model KnowledgeItem {
  id               String            @id @default(cuid())
  slug             String            @unique
  title            String
  contentType      KnowledgeItemType
  renderPayload    Json
  domain           String
  subdomain        String?
  summary          String
  body             String
  intuition        String?
  derivation       String?
  useConditions    String[]
  nonUseConditions String[]
  antiPatterns     String[]
  typicalProblems  String[]
  examples         String[]
  difficulty       Int
  tags             String[]
  extension        Json?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  variables         KnowledgeItemVariable[]
  reviewItems       ReviewItem[]
  outgoingRelations KnowledgeItemRelation[] @relation("KnowledgeItemRelationFrom")
  incomingRelations KnowledgeItemRelation[] @relation("KnowledgeItemRelationTo")
  userStates        UserKnowledgeItemState[]
  reviewLogs        ReviewLog[]
  memoryHooks       KnowledgeItemMemoryHook[]
  productEvents     ProductEvent[]

  @@index([domain, subdomain])
  @@index([contentType])
  @@map("knowledge_items")
}
```

Initial payload shapes:

```ts
type MathFormulaPayload = {
  latex: string;
};

type VocabularyPayload = {
  term: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition: string;
  examples?: string[];
};

type PlainTextPayload = {
  text: string;
};
```

`KnowledgeItemVariable` remains available for formula-like content. Other item
types can leave it empty.

## TypeScript Contracts

Create `src/types/knowledge-item.ts` to replace `src/types/formula.ts`.

Core public types:

```ts
export type KnowledgeItemType = "math_formula" | "vocabulary" | "plain_text";

export type KnowledgeItemRenderPayload =
  | { type: "math_formula"; latex: string }
  | {
      type: "vocabulary";
      term: string;
      phonetic?: string;
      partOfSpeech?: string;
      definition: string;
      examples?: string[];
    }
  | { type: "plain_text"; text: string };
```

`KnowledgeItemSummary` should expose:

- `id`
- `slug`
- `title`
- `contentType`
- `renderPayload`
- `domain`
- `subdomain`
- `summary`
- `difficulty`
- `tags`
- generic training status fields
- counts for review items and memory hooks

`KnowledgeItemDetail` should extend the summary with body text, conditions,
examples, variables, review items, relations, and memory hooks.

## Renderer Plugins

Add a renderer registry under:

```text
src/components/knowledge-item/renderers/
```

Files:

- `types.ts`
- `registry.ts`
- `math-formula-renderer.tsx`
- `vocabulary-renderer.tsx`
- `plain-text-renderer.tsx`
- `knowledge-item-renderer.tsx`

Renderer interface:

```ts
export type KnowledgeItemRendererPlugin<TPayload> = {
  type: KnowledgeItemType;
  label: string;
  renderInline(payload: TPayload): React.ReactNode;
  renderBlock(payload: TPayload): React.ReactNode;
};
```

Behavior:

- `math_formula` uses KaTeX to render `latex`.
- `vocabulary` renders the term, optional phonetic text, optional part of
  speech, definition, and examples.
- `plain_text` renders the text with readable wrapping and line breaks.
- Unknown or invalid payloads should show a clear fallback state in UI and fail
  validation on create/update paths.

Plugins are static application modules, not user-uploaded code.

## Routes and API

Rename user-facing routes:

- `/formulas` -> `/knowledge-items`
- `/formulas/new` -> `/knowledge-items/new`
- `/formulas/[id]` -> `/knowledge-items/[id]`

Rename API routes:

- `/api/formulas` -> `/api/knowledge-items`
- `/api/formulas/[id]` -> `/api/knowledge-items/[id]`
- `/api/formulas/[id]/relations` -> `/api/knowledge-items/[id]/relations`
- `/api/formulas/[id]/memory-hooks` -> `/api/knowledge-items/[id]/memory-hooks`
- `/api/formulas/draft` -> `/api/knowledge-items/draft`

Review, diagnostic, stats, and content-assist APIs keep their functional route
names but rename request and response fields from formula IDs to knowledge item
IDs.

## Server Modules

Rename service and repository modules:

- `formula-service.ts` -> `knowledge-item-service.ts`
- `formula-repository.ts` -> `knowledge-item-repository.ts`
- `formula-draft-service.ts` -> `knowledge-item-draft-service.ts`

Functions should be renamed to match the new domain:

- `getKnowledgeItemSummaries`
- `getKnowledgeItemCatalog`
- `getKnowledgeItemDetail`
- `addCustomKnowledgeItem`
- `getKnowledgeItemMemoryHooks`
- `saveKnowledgeItemMemoryHook`
- `getKnowledgeItemRelationDetails`

Review, diagnostic, and stats services should use `knowledgeItemId` internally
and externally. The scheduling algorithm does not need content-type-specific
logic.

## Authoring and Import

The new custom item form should start with a content type selector. The selected
type controls the fields used to build `renderPayload`:

- Math formula: title, LaTeX, summary, optional variables.
- Vocabulary: term/title, phonetic, part of speech, definition, examples.
- Plain text: title, text, summary.

Shared learning fields remain available for every type:

- domain
- subdomain
- summary
- body
- use conditions
- non-use conditions
- anti-patterns
- typical problems
- examples
- difficulty
- tags
- memory hook

Bulk import accepts either one object or an array of objects with `contentType`
and type-specific payload fields.

AI draft generation should become generic. The system prompt should ask for a
knowledge item draft, not a formula draft, and return `contentType` plus the
matching payload fields. If the user input is ambiguous, default to `plain_text`.

## Seed Data

Update `prisma/seed.ts` to seed `KnowledgeItem` records.

Existing math formula seed data should be converted:

- `contentType: "math_formula"`
- `renderPayload: { latex: old.expressionLatex }`
- `summary: old.oneLineUse`
- `body: old.meaning`

Add a small number of non-formula seed items so the product proves mixed-type
domains work:

- one vocabulary item inside a language-oriented domain
- one plain text item inside a general study/process domain

## UI Copy

Replace product copy that implies all content is formula-only:

- "公式列表" -> "知识项列表"
- "添加自定义公式" -> "添加自定义知识项"
- "关联公式" -> "关联知识项"
- "薄弱公式" -> "薄弱知识项"
- "变量说明" remains visible only when variables exist.
- "推导过程" can remain for math formulas, but should be generalized or hidden
  when irrelevant.

The app name may remain FormulaLab for now unless a later branding pass changes
it. The feature surface should no longer assume formula-only content.

## Testing

Use TDD for implementation.

Required coverage:

- Renderer registry selects the correct renderer for all three initial types.
- Invalid payloads fail validation during create/import.
- Creating a vocabulary item returns a knowledge item with the expected
  `contentType`, `renderPayload`, and review items.
- Catalog filters can mix content types under a domain.
- Review queues work for a non-formula item.
- Existing diagnostic and stats unit/e2e coverage is updated from formula naming
  to knowledge item naming.

Verification commands:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Rollout

Because this is a development-stage breaking change:

1. Update schema and baseline migration directly.
2. Regenerate Prisma client.
3. Update seed data.
4. Rename types, services, repositories, routes, and components.
5. Update UI copy and navigation links.
6. Update tests.
7. Reset local data through the existing development database reset flow if
   needed.

No compatibility redirects, aliases, or fallback API names are required.

## Open Decisions

- Route naming is fixed as `/knowledge-items` for clarity and explicitness.
- Database table naming is fixed as `knowledge_items`.
- Plugin runtime is static and code-defined for this redesign.
- The first implementation should include only `math_formula`, `vocabulary`,
  and `plain_text`.

# OpenAI-Compatible AI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DeepSeek/Kimi-compatible AI support for admin import, review hints, and memory hook drafts.

**Architecture:** Introduce a server-only OpenAI-compatible chat client that returns parsed JSON or text. Existing feature services call that client and keep deterministic mock paths for tests/local development.

**Tech Stack:** Next.js App Router, TypeScript, native `fetch`, Prisma, Node test runner.

---

### Task 1: Shared AI Client

**Files:**
- Create: `src/server/ai/openai-compatible.ts`
- Test: `tests/unit/openai-compatible-ai.test.ts`
- Modify: `.env.example`

- [ ] Write failing tests for provider resolution, JSON extraction, missing key handling, and chat completion request shape.
- [ ] Implement provider defaults for `mock`, `deepseek`, `kimi`, and `custom`.
- [ ] Implement `chatJson` and `chatText` helpers using `/chat/completions`.
- [ ] Add empty AI env placeholders to `.env.example`.
- [ ] Run `npm run test -- tests/unit/openai-compatible-ai.test.ts`.

### Task 2: Admin Import Provider

**Files:**
- Modify: `src/server/admin/admin-import-ai.ts`
- Test: `tests/unit/admin-import-ai.test.ts`

- [ ] Add failing tests for `ADMIN_IMPORT_PROVIDER=ai` using the shared client path.
- [ ] Keep `mock` deterministic.
- [ ] Route `ai` and `openai-compatible` through `chatJson`.
- [ ] Keep existing validation outside the model call.
- [ ] Run `npm run test -- tests/unit/admin-import-ai.test.ts`.

### Task 3: AI Review Hints

**Files:**
- Modify: `src/types/review.ts`
- Modify: `src/server/repositories/review-repository.ts`
- Modify: `src/server/services/review-service.ts`
- Test: `tests/unit/review-ai-hint.test.ts`

- [ ] Add failing tests proving personal hooks win, AI is used when no hook exists, and summary fallback is used when AI fails.
- [ ] Include active review item context in the hint source query.
- [ ] Add `ai` to `ReviewHintSource`.
- [ ] Generate a short non-answer hint with the shared AI client.
- [ ] Run `npm run test -- tests/unit/review-ai-hint.test.ts`.

### Task 4: Memory Hook Drafts

**Files:**
- Create: `src/app/api/knowledge-items/[id]/memory-hooks/draft/route.ts`
- Modify: `src/server/repositories/knowledge-item-repository.ts`
- Modify: `src/server/services/knowledge-item-service.ts`
- Modify: `src/components/memory-hooks/knowledge-item-memory-hook-panel.tsx`
- Test: `tests/unit/memory-hook-ai-draft.test.ts`

- [ ] Add failing service tests for generating a draft without saving.
- [ ] Add a service function that loads knowledge item context and asks AI for one short self-reminder.
- [ ] Add an authenticated route returning `{ data: { content } }`.
- [ ] Add a client button that fills the textarea with the draft.
- [ ] Run `npm run test -- tests/unit/memory-hook-ai-draft.test.ts`.

### Task 5: Full Verification

**Files:**
- All touched files.

- [ ] Run `npm run lint`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Review `git diff` for accidental secret leakage.

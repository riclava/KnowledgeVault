# OpenAI-Compatible AI Integration Design

## Goal

Embed AI capabilities into KnowledgeVault through OpenAI-compatible chat APIs, starting with DeepSeek and Kimi while keeping local development safe through mock defaults.

## Current Context

KnowledgeVault already has an admin AI import path in `src/server/admin/admin-import-ai.ts`. It supports a deterministic mock provider and an OpenAI Responses API provider. The rest of the product has two natural AI surfaces:

- review hints, currently backed by personal memory hooks or the knowledge item summary
- memory hooks, currently written manually by learners

The project is in active development, so configuration and database shape can be changed directly when needed. This first AI integration does not require schema changes.

## Provider Model

Add a shared server-only OpenAI-compatible client for chat completions. It should read provider configuration from environment variables and expose a small JSON-focused API for feature services.

Environment variables:

- `AI_PROVIDER`: `mock`, `deepseek`, `kimi`, or `custom`
- `AI_API_KEY`: provider API key
- `AI_BASE_URL`: optional override for custom or provider-specific deployments
- `AI_MODEL`: optional override for model name

Provider defaults:

- `mock`: no network, deterministic local output
- `deepseek`: `https://api.deepseek.com`, model `deepseek-chat`
- `kimi`: `https://api.moonshot.ai/v1`, model configured through `AI_MODEL`
- `custom`: requires `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`

Secrets must never be committed. `.env.example` should document empty placeholders only.

## Admin Import

Replace the current OpenAI Responses API-specific network path with the shared compatible chat client. The import generator should still produce an `AdminImportBatch`, and the existing validation and save pipeline remains mandatory.

The prompt should ask for strict JSON only. Since OpenAI-compatible providers vary in structured output support, the app should parse JSON from plain assistant text and then rely on the existing validator to reject malformed or incomplete batches.

`ADMIN_IMPORT_PROVIDER=mock` remains supported for deterministic tests and local UI. `ADMIN_IMPORT_PROVIDER=openai-compatible` or `ADMIN_IMPORT_PROVIDER=ai` should call the shared AI client.

## Review Hints

When the learner requests a hint:

1. If a personal memory hook exists, return it.
2. Otherwise, generate an AI hint from the review prompt, answer, explanation, and knowledge item summary/body.
3. The hint must not reveal the answer directly.
4. If AI is disabled, unavailable, or fails, fall back to the existing one-line summary behavior.

The API response keeps the same shape, with a new `source` value of `ai`.

## Memory Hook Drafts

Add a learner-facing endpoint that drafts a personal memory hook for one knowledge item. The draft should be short, concrete, and written as a self-reminder. The UI should add a button in the existing memory hook panel to generate a draft into the textarea without saving automatically.

This keeps the learner in control and avoids storing unreviewed model output.

## Error Handling

AI failures should degrade gracefully:

- admin import records `ai_failed`
- review hints return the normal one-line fallback
- memory hook draft endpoint returns a user-facing error without modifying saved hooks

Error details should stay server-side except for concise messages needed by the UI.

## Testing

Unit coverage should include:

- provider default resolution for DeepSeek, Kimi, custom, and mock
- chat completion payload construction and JSON extraction
- admin import using the compatible provider without calling the old Responses API
- review hint AI fallback and summary fallback
- memory hook draft generation

Existing admin import validation tests continue to protect persistence.

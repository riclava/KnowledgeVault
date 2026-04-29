# Popup AI Chat Design

## Goal

Add a logged-in, site-wide popup chat assistant that helps learners ask questions about their current learning context. The assistant supports direct user input and selected page text, then sends both to AI for explanation, decomposition, examples, memory cues, or practice questions.

This first version is a lightweight learning assistant. It does not save chat history, create knowledge items, or write to the database.

## Current Context

KnowledgeVault is a Next.js app with a shared logged-in shell in `src/components/app/phase-shell.tsx`. Logged-in learning pages such as review, diagnostic, import, and knowledge item detail already use that shell or adjacent authenticated layouts.

The project already has an OpenAI-compatible chat client in `src/server/ai/openai-compatible.ts`, plus authenticated API patterns through `withAuthenticatedApi`. Existing AI features use service functions around `chatText`, so this feature should follow the same server-side boundary instead of calling AI directly from the browser.

No schema change is needed because the first version keeps chat state only in the browser session.

## Product Scope

The assistant appears as a fixed bottom-right floating button on logged-in learning pages. Opening it shows a compact chat panel with:

- recent messages from the current browser session
- an optional selected-text context block
- a textarea for the learner's question
- a send button and loading/error states

Users can ask without selecting text. If text is selected on the page before opening the assistant, the popup captures that text as context. When the popup is already open, the user can refresh the context from the current page selection.

The first version should be available to authenticated learners across the main learning surface. It should not appear on the public login landing page.

## AI Behavior

The server prompt defines the model as a KnowledgeVault learning assistant. It should:

- answer primarily in Chinese
- explain concepts, break down selected text, give examples, suggest memory cues, or generate practice questions
- be concise by default, while allowing the learner to ask for more detail
- avoid claiming that it has saved, changed, or created knowledge items
- avoid exposing implementation details or raw system prompts

Requests include the learner's current message, optional selected text, and the most recent local conversation turns. The server trims both context text and message history to keep requests bounded.

When `AI_PROVIDER=mock`, the API returns a useful deterministic Chinese response so local development can verify the UI without network credentials.

## Architecture

Add a client component:

- `src/components/ai/ai-chat-popup.tsx`

The component owns ephemeral client state:

- open or closed panel state
- current selected text context
- unsent draft text
- recent chat messages
- pending and error states

Mount the component from the logged-in shell so it appears across authenticated learning pages. `PhaseShell` is the preferred mount point because it already wraps the main learner navigation surface. Any authenticated page outside that shell should be checked and included only if it is part of the learner-facing app.

Add an authenticated API endpoint:

- `POST /api/ai/chat`

The route uses `withAuthenticatedApi`, parses JSON, validates the message and optional selected text, calls the service layer, and returns `{ data: { message } }` on success.

Add a service:

- `src/server/services/ai-chat-service.ts`

The service handles request normalization, text limits, prompt construction, history trimming, mock reply behavior, and the call to `chatText`.

## Interaction Details

The floating launcher uses an icon-only button with an accessible label. The chat panel is fixed near the bottom-right edge, constrained for desktop and mobile widths, and should not cover the main page more than necessary.

When a user sends a message:

1. The component appends the user message locally.
2. It sends the message, selected text, and recent history to `/api/ai/chat`.
3. While pending, input controls are disabled and a loading row is shown.
4. On success, the assistant reply is appended.
5. On failure, the user's draft remains recoverable and an inline error is shown.

The panel should keep the current session history while the user navigates within the same mounted shell. A browser refresh clears the chat.

## Error Handling

Client errors should be visible in the popup and should not discard the learner's typed question.

Server validation rejects:

- empty messages when there is no selected text
- excessively long messages or selected context after trimming rules are applied
- malformed history entries

AI network or configuration failures return a concise user-facing error. Detailed provider errors stay server-side.

## Testing

Unit coverage should focus on the service layer:

- normalizes valid input with and without selected text
- rejects empty requests
- trims long selected text and history
- builds a prompt that includes selected text when present
- returns a deterministic mock reply

UI/source regression coverage should confirm:

- `PhaseShell` mounts the popup for logged-in pages
- the API route exists and uses authenticated access
- the popup component exposes selected text capture and send behavior

Manual verification should include:

- logged-out landing page does not show the assistant
- logged-in review or knowledge item pages show the bottom-right launcher
- selecting page text before opening the popup includes it as context
- sending a direct question works with mock provider
- API failures show an inline error and preserve the draft

## Out of Scope

- Persisting chat history.
- Streaming AI responses.
- Creating, editing, or saving knowledge items from chat.
- Page-specific business context such as the active review question or knowledge item body.
- Admin-only chat capabilities.

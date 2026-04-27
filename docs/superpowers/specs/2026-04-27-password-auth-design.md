# Password Auth Design

## Goal

KnowledgeVault should use email plus password as its only login mode. Users can
register and sign in from the app UI, then continue into the existing review
flow with the same Better Auth session and learner binding.

## Scope

- Remove magic link authentication from server and client configuration.
- Enable Better Auth email/password authentication with self-service sign-up.
- Replace the magic link form with a password auth form that supports sign-in
  and registration.
- Update homepage, account page, and deployment docs so no user-facing copy
  refers to magic links, email delivery, or Resend.
- Keep the current `AuthUser`, `AuthSession`, `AuthAccount`, and learner
  mapping models. `auth_accounts.password` already exists in the Prisma schema
  and baseline migration, so no new migration file is needed.

## Architecture

Better Auth remains the source of truth for credentials and sessions. The auth
server config enables `emailAndPassword` and keeps the existing Prisma adapter,
cookie plugin, session lifetime, and model mappings.

The client auth module uses the default Better Auth React client. A focused
client component owns form state, validation, mode switching, calls
`authClient.signIn.email` or `authClient.signUp.email`, and refreshes the
router after successful authentication.

Existing server routes continue to call `getCurrentLearner` and
`requireCurrentLearner`. The learner creation path remains unchanged because it
already maps an authenticated Better Auth user to the app-level `User` record.

## UI Behavior

- Unauthenticated users see one account form with two modes: "登录" and "注册".
- Login requires email and password.
- Registration requires display name, email, and password.
- Passwords must be at least 8 characters because Better Auth defaults to that
  minimum and the server config makes it explicit.
- Successful login or registration navigates to the provided callback URL and
  refreshes server-rendered session state.
- Errors from Better Auth are shown inline in the form.

## Error Handling

Client-side checks catch empty email, empty password, short password, and missing
registration name before calling the auth API. Server-side Better Auth errors
remain authoritative for invalid credentials, duplicate email, and malformed
input.

## Testing

Add a unit-level source assertion test for the auth surface: account-facing
files must reference password login/register copy and must not include magic
link terminology. Run this test red first before implementation. Use TypeScript,
lint, and build verification to validate Better Auth method names and React
component integration.

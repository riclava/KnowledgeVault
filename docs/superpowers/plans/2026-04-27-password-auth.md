# Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace magic link authentication with in-page email/password login and registration.

**Architecture:** Keep Better Auth and Prisma as the auth/session foundation. Enable `emailAndPassword`, remove magic link plugins and mail delivery, and replace the client form with a focused login/register component.

**Tech Stack:** Next.js App Router, React client components, Better Auth, Prisma, node:test, ESLint.

---

## File Map

- Modify `src/lib/auth.ts`: enable email/password and remove magic link delivery.
- Modify `src/lib/auth-client.ts`: remove magic link client plugin.
- Create `src/components/account/password-auth-form.tsx`: login/register form.
- Modify `src/components/account/account-panel.tsx`: use the new form and update copy.
- Modify `src/app/page.tsx`: use the new form and update homepage auth copy.
- Modify `src/app/account/page.tsx`: update account status copy.
- Modify `docs/deployment.md`: remove Resend/magic link environment details.
- Add `tests/unit/password-auth-copy.test.ts`: source-level regression check.

## Tasks

### Task 1: Add Failing Auth Copy Test

- [ ] Create `tests/unit/password-auth-copy.test.ts` asserting auth-facing files contain password login/register copy and no magic link terms.
- [ ] Run `npm run test -- tests/unit/password-auth-copy.test.ts`; expected result before implementation: fails because current files still contain magic link copy.

### Task 2: Switch Better Auth Configuration

- [ ] Update `src/lib/auth.ts` to remove `magicLink`, email sending helpers, and Resend fetch logic.
- [ ] Add `emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true }` to the Better Auth config.
- [ ] Update `src/lib/auth-client.ts` so it creates the default Better Auth client without the magic link plugin.

### Task 3: Replace Client Auth Form

- [ ] Remove `src/components/account/magic-link-sign-in-form.tsx`.
- [ ] Create `src/components/account/password-auth-form.tsx` with sign-in and sign-up modes.
- [ ] Login path calls `authClient.signIn.email({ email, password, callbackURL })`.
- [ ] Register path calls `authClient.signUp.email({ name, email, password, callbackURL })`.
- [ ] On success, push to `callbackURL` and refresh the router.

### Task 4: Update Pages and Docs

- [ ] Replace imports and JSX in `src/components/account/account-panel.tsx`.
- [ ] Replace imports and JSX in `src/app/page.tsx`.
- [ ] Update `src/app/account/page.tsx` status cards and copy.
- [ ] Update `docs/deployment.md` to document only the required auth env vars and account/password behavior.

### Task 5: Verify

- [ ] Run `npm run test -- tests/unit/password-auth-copy.test.ts`; expected result: pass.
- [ ] Run `npm run lint`; expected result: pass.
- [ ] Run `npm run build`; expected result: pass.

# AI workflow note

## Tools

- **Claude Code (Claude Opus 5.5)** in the terminal as the main pair-programmer. I used a structured
  workflow: brainstorm → written design spec → implementation plan → build task-by-task with tests.
  The spec and plan are committed under [`docs/superpowers/`](docs/superpowers/).
- **Context7** (`ctx7` CLI) to pull *current* docs for Next.js 16, TipTap 3 and PGlite instead of
  relying on model memory. This mattered: several APIs changed recently.
- **Headless Chrome via `playwright-core`**, driven by a script the AI wrote, to click through every flow
  and capture the screenshots in `docs/screenshots/`.

## Where AI materially sped things up

- **Scaffolding and boilerplate:** route handlers, zod schemas, the error envelope, the TipTap toolbar.
- **The test suite:** the sharing/permission integration tests against in-memory Postgres were drafted
  quickly and caught nothing wrong — but they made the access rules cheap to change with confidence.
- **Catching framework changes early:** Next 16 makes route `params` a Promise and renames middleware
  to `proxy`. Its scaffold also enables Cache Components by default. TipTap 3 bundles Underline in
  StarterKit and no longer re-renders on every keystroke, so the toolbar needs `useEditorState`.
- **Verification at a breadth I wouldn't do by hand in a timebox:** a curl pass over every API status
  code (401/403/404/409/400/415) and a scripted browser run over every user flow.

## What I decided, changed, or rejected

**Product decisions stayed with me.** The AI proposed options; I chose:
- **Vercel + Neon**, with PGlite for local runs.
- **Seeded users with a real password login.** I rejected its recommended one-click "user switcher" in
  favour of a more realistic login flow.
- **Which stretch items to build:** viewer/editor roles, stale-save conflicts and Markdown export. I
  rejected version history as too expensive for the timebox.
- **Which Vercel team to deploy to.** The CLI asked, and the AI deferred to me rather than picking one.

**AI output I changed or overrode:**
- **The Next 16 scaffold turned on `cacheComponents`.** I turned it off. React `<Activity>` keeps visited
  routes alive with their state, so returning to a document could show a stale in-memory copy instead of
  fresh content from the server. Every page here is per-user anyway.
- **A literal invisible BOM character ended up inside a regex in generated code.** It worked, but it was
  unreadable and fragile. I caught it on review and replaced it with an explicit escape.
- **An over-built zod enum `.transform` cast** got replaced with a plain `z.enum`.
- **A `window.location` download** was flagged by lint, so it became an anchor download.
- **The Vercel CLI appended `.env*` to `.gitignore`** *after* the `!.env.example` exception, which would
  have re-ignored the example env file. I caught it and fixed it.
- **The bundled Vercel CLI (v34) was too old** for the API. I used the current CLI via `npx` rather than
  changing the global install.
- **Toolchain conflict:** Vitest 5 needs `@types/node` 22 or newer, so I aligned it with the Node 22
  runtime instead of forcing `--legacy-peer-deps`.
- **A real race condition, found by the browser walkthrough.** If you typed a second email while the
  first share request was still in flight, the dialog cleared your new input when the first request
  finished. The fix only clears the field if it still holds the address that was just shared.
- **Copy consistency:** the seeded doc said "Shared with me" while the UI says "Shared with you". This
  was found by reviewing screenshots, not by tests.

**Guardrails:** the AI is configured never to read or print secret values (a pre-tool hook enforces it).
`SESSION_SECRET` was generated and piped straight into Vercel by me, so it never appeared in the AI
session.

## How I verified correctness, UX and reliability

1. **Tests:** 29 Vitest tests covering the permission matrix, sharing lifecycle, 409 conflicts,
   sanitization, import/export (including a generated .docx), and session-token tampering and expiry.
   - Honest caveat: the service tests were written first and seen failing before implementation (TDD).
   - The import/export tests were written in the same step as the code, so I never saw them fail first.
2. **Static checks:** `tsc --noEmit`, ESLint and `next build` are all clean.
3. **API smoke test** with curl, checking every error path returns the intended status and message.
4. **Browser walkthrough:** a scripted, real-Chrome run of login, formatting, rename and
   reload-persistence, share, viewer read-only, a two-user conflict, .docx import, Markdown export and
   an invalid upload.
   - Its failures had different causes, and telling them apart was the judgment part.
   - Two were bugs in the test script: ambiguous selectors, and a non-idempotent run against a
     persisted database.
   - One was the genuine share-dialog race described above.
   - The final script is in the repo as `npm run e2e`.
5. **Visual review** of each screenshot. This caught the copy mismatch and a double focus ring on the
   title field.
6. **Production smoke test** after deploying: the same flows against the live URL.

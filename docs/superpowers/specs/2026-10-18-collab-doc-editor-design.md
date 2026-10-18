# Collaborative Doc Editor — Design (approved 2026-10-18)

Take-home for Ajaia (Full Stack Product Engineer). Timeboxed (~4h). Goal: the strongest
coherent slice of a Google-Docs-like editor: create / rename / rich-text edit / save & reopen,
file import, sharing with owner + roles, persistence, deployed build, tests, docs.

## Decisions

| Area | Decision | Why |
|---|---|---|
| Stack | Next.js (App Router, TypeScript) single app, route handlers for API | One deploy unit, native on Vercel |
| Editor | TipTap (ProseMirror) | Mature rich-text, schema-enforced formatting, React bindings |
| Prod DB | Neon Postgres via Vercel Storage integration (`DATABASE_URL`) | Free, survives serverless |
| Local/test DB | PGlite (embedded Postgres, WASM) — `.data/pglite` in dev, in-memory in tests | Zero setup for reviewers, same SQL dialect as prod |
| Schema mgmt | Idempotent `CREATE TABLE IF NOT EXISTS` + seed on first use | No migration step for reviewers; tradeoff documented |
| Content format | Sanitized HTML (allowlist = editor features) | Import (mammoth/marked) and export (turndown) are HTML-native; readable in DB |
| Auth | Seeded users + shared demo password; scrypt hashes; HMAC-signed httpOnly cookie (`SESSION_SECRET`) | Realistic login without sign-up scope |
| Sharing | Owner + per-user shares with role `viewer` / `editor` | Covers required sharing + role stretch |
| Concurrency | Integer `version` on documents; PATCH carries `baseVersion`; mismatch → 409 | Prevents silent overwrites between collaborators |
| Export | Markdown download (turndown) | Cheap, product-relevant |

## Data model

- `users(id uuid pk, email unique, name, password_hash, created_at)`
- `documents(id uuid pk, owner_id → users, title, content html, version int, created_at, updated_at)`
- `document_shares(document_id → documents on delete cascade, user_id → users, role in ('viewer','editor'), created_at, pk(document_id, user_id))`

## Access rules (`lib/access.ts`, pure)

| Role | read | edit content/title | manage shares | delete |
|---|---|---|---|---|
| owner | ✓ | ✓ | ✓ | ✓ |
| editor | ✓ | ✓ | – | – |
| viewer | ✓ | – | – | – |
| none | 404 (do not leak existence) | | | |

Authenticated user with access but lacking permission → 403. Unauthenticated → 401.

## API

- `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/documents` → `{ owned, shared }`
- `POST /api/documents` → create (optional title)
- `GET | PATCH | DELETE /api/documents/:id` — PATCH `{ title?, content?, baseVersion }` → `{ version }` or 409
- `POST /api/documents/import` — multipart; `.txt` `.md` `.docx`, ≤ 4 MB → new document
- `GET | POST /api/documents/:id/shares`, `DELETE /api/documents/:id/shares/:userId` (owner only)
- `GET /api/documents/:id/export` → `.md` download

Errors: `{ error: { code, message } }`. Validation with zod. Title 1–200 chars, content ≤ 1 MB.

## UI

- `/login` — email/password; demo credentials shown on page.
- `/` dashboard — New document, Import file (types stated), "My documents" and "Shared with me"
  (owner name + role badge), delete for owned docs.
- `/documents/[id]` — inline title rename, toolbar (B / I / U, H1–H3, paragraph, bullet / numbered
  list, undo / redo), debounced autosave (~800 ms) + Ctrl/Cmd+S, status (Saving / Saved / Error /
  Conflict → reload banner), Share dialog (email + role, list + revoke), Export .md, read-only mode
  for viewers.

## Testing (Vitest)

- Integration against in-memory PGlite: owner/viewer/editor/stranger access matrix through the
  document service; stale-version conflict.
- Unit: access rules, import converters (txt / md / docx), sanitizer strips scripts.

## Deliberately out of scope

Real-time co-editing (CRDT/Yjs), presence, comments, version history, sign-up / real identity,
images & attachments, PDF export, mobile polish.

## Deliverables

`README.md`, `ARCHITECTURE.md`, `AI_WORKFLOW.md`, `SUBMISSION.md`, `VIDEO_URL.txt`.

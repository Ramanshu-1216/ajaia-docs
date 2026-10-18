# Collaborative Doc Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Timebox note:** this plan is deliberately lean (contracts + tests + acceptance per task, not full code)
> because it is executed inline, immediately, by the same session under a ~4h assignment timer.

**Goal:** Ship a deployed Google-Docs-lite: auth'd users create/rename/edit rich-text docs, import files, share with viewer/editor roles, export Markdown.

**Architecture:** Next.js 16 App Router monolith. Server components read through a document service
(`lib/documents.ts`) that owns all access rules; client components mutate through JSON route handlers.
One `Db` interface backed by `pg` (Neon, when `DATABASE_URL` is set) or PGlite (local dir / in-memory tests).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, TipTap 3, PGlite 0.5, pg 8, zod 4, sanitize-html, marked, mammoth, turndown, Vitest.

## Global Constraints

- Secrets only via `process.env.DATABASE_URL` / `process.env.SESSION_SECRET`; never inline or read values.
- Errors are JSON `{ error: { code, message } }`; no access → 404; access but not allowed → 403; no session → 401; stale version → 409.
- Title 1–200 chars; content ≤ 1 MB; upload ≤ 4 MB, extensions `.txt .md .docx` only (stated in UI + README).
- Stored HTML always passes `sanitizeDocHtml` (allowlist: p br h1 h2 h3 strong em u s ul ol li blockquote code pre a hr).
- Seeded users: alice@ajaia.dev, bob@ajaia.dev, carol@ajaia.dev; one demo password (documented).

## File map

| File | Responsibility |
|---|---|
| `lib/db.ts` | `Db` interface, `getDb()` singleton (pg or PGlite), `createMemoryDb()`, `initDb()` (schema + seed) |
| `lib/passwords.ts` | `hashPassword`, `verifyPassword` (scrypt) |
| `lib/errors.ts` | `AppError`, `errorResponse(err)` |
| `lib/access.ts` | `Role`, `Action`, `can(role, action)` — pure |
| `lib/documents.ts` | document + share service (all SQL for docs/shares, all access checks) |
| `lib/sanitize.ts` | `sanitizeDocHtml(html)` |
| `lib/importers.ts` | `importFile(name, bytes) → { title, html }` |
| `lib/exporters.ts` | `htmlToMarkdown(html)` |
| `lib/session.ts` | `signSession` / `verifySession` (pure), `getCurrentUser()`, cookie helpers |
| `lib/http.ts` | `handle()` route wrapper, `requireUser()`, `readJson(req, schema)` |
| `app/api/**/route.ts` | thin HTTP adapters over the service |
| `app/login/*`, `app/page.tsx`, `app/documents/[id]/*`, `components/*` | UI |
| `tests/*.test.ts` | Vitest |

## Interfaces (shared contracts)

```ts
// lib/db.ts
export interface Db { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>; exec(sql: string): Promise<void> }
export function getDb(): Promise<Db>
export function createMemoryDb(): Promise<Db>          // schema + seed applied
export const DEMO_PASSWORD: string
// lib/access.ts
export type Role = 'owner' | 'editor' | 'viewer'
export type Action = 'read' | 'edit' | 'share' | 'delete'
export function can(role: Role | null, action: Action): boolean
// lib/documents.ts  (all throw AppError)
export interface DocSummary { id: string; title: string; updatedAt: string; ownerName: string; role: Role }
export interface DocRecord extends DocSummary { content: string; version: number; ownerId: string }
export interface ShareEntry { userId: string; email: string; name: string; role: 'viewer' | 'editor' }
listDocuments(db, userId): Promise<{ owned: DocSummary[]; shared: DocSummary[] }>
createDocument(db, userId, input: { title?: string; content?: string }): Promise<DocRecord>
getDocument(db, userId, docId): Promise<DocRecord>
updateDocument(db, userId, docId, input: { title?: string; content?: string; baseVersion: number }): Promise<{ version: number; updatedAt: string }>
deleteDocument(db, userId, docId): Promise<void>
listShares(db, userId, docId): Promise<ShareEntry[]>
shareDocument(db, userId, docId, input: { email: string; role: 'viewer' | 'editor' }): Promise<ShareEntry>
revokeShare(db, userId, docId, targetUserId): Promise<void>
```

---

### Task 1: Scaffold + tooling
- [ ] create-next-app (TS, Tailwind, App Router, ESLint) in temp dir, move into repo; add deps
- [ ] `vitest.config.ts` (node env, `@` alias), `npm test` script; `next.config.ts` `serverExternalPackages: ['@electric-sql/pglite']`
- [ ] `.gitignore` includes `.data/`, `.env*` (except `.env.example`); add `.env.example` with key names only
- [ ] Commit

### Task 2: Persistence + document service (TDD)
- [ ] Write `tests/documents.test.ts` against `createMemoryDb()`:
  - Alice creates doc → appears in Alice `owned`, not in Bob lists
  - Bob `getDocument` → 404; Alice shares with bob as viewer → Bob sees in `shared` with role viewer, `getDocument` ok, `updateDocument` → 403, `shareDocument` by Bob → 403
  - Alice upgrades Bob to editor → Bob update succeeds, version increments
  - stale `baseVersion` → 409; Carol → 404 throughout; owner-only delete; sharing with unknown email → 404; with self → 400
- [ ] `tests/access.test.ts`: full role × action matrix
- [ ] Run → fail; implement `lib/db.ts`, `lib/passwords.ts`, `lib/errors.ts`, `lib/access.ts`, `lib/documents.ts`, `lib/sanitize.ts` (content sanitized on write); run → pass; commit

### Task 3: Import / export (TDD)
- [ ] `tests/importers.test.ts`: txt → escaped paragraphs; md headings/lists/bold → tags; docx (built with `docx` dev-dep) heading + bold preserved; unsupported ext → 415; >4 MB → 413; `<script>` stripped; md export round-trip of heading/list/bold
- [ ] Implement `lib/importers.ts`, `lib/exporters.ts`; pass; commit

### Task 4: Session + auth
- [ ] `tests/session.test.ts`: sign→verify ok; tampered payload/signature → null; expired → null
- [ ] Implement `lib/session.ts` (HMAC-SHA256, 7-day expiry, httpOnly lax cookie, `SESSION_SECRET` required on Vercel), `lib/http.ts`
- [ ] Routes: `POST /api/auth/login` (zod email/password, generic "Invalid email or password"), `POST /api/auth/logout`
- [ ] Commit

### Task 5: Document API routes
- [ ] `app/api/documents/route.ts` GET list / POST create
- [ ] `app/api/documents/[id]/route.ts` GET / PATCH (zod: title 1–200, content ≤ 1 MB, baseVersion int) / DELETE
- [ ] `app/api/documents/import/route.ts` multipart → `importFile` → `createDocument`
- [ ] `app/api/documents/[id]/shares/route.ts` GET/POST, `.../shares/[userId]/route.ts` DELETE
- [ ] `app/api/documents/[id]/export/route.ts` → `text/markdown` attachment
- [ ] `npx tsc --noEmit` clean; commit

### Task 6: UI
- [ ] `/login` (form + demo creds), header with current user + sign out
- [ ] `/` dashboard: New, Import (accept=".txt,.md,.docx", 4 MB note), My documents / Shared with me (owner + role badge), delete owned
- [ ] `/documents/[id]`: title rename, toolbar (B/I/U, Paragraph/H1–H3, bullets/numbers, undo/redo), autosave queue (single in-flight PATCH, 800 ms debounce, Ctrl/Cmd+S), status pill, conflict banner (Reload / Overwrite), viewer read-only, Share dialog, Export .md, beforeunload guard
- [ ] Manual browser pass of the full flow as Alice → Bob → Carol; commit

### Task 7: Ship
- [ ] `npm run build` + `npm test` green
- [ ] Vercel: link project, user adds Neon (Storage) + `SESSION_SECRET`; deploy; smoke test prod
- [ ] Docs: README, ARCHITECTURE, AI_WORKFLOW, SUBMISSION, VIDEO_URL.txt, `samples/` (txt/md/docx); commit

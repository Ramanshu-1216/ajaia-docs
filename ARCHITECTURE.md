# Architecture note

## What I optimized for

The brief rewards a coherent product slice over breadth. I picked the parts that make a document tool
*trustworthy* and went deep on them:

1. **Editing that never loses work** — autosave with a visible status, retry on network errors,
   unsaved-changes guard, and version-checked saves so two collaborators can't silently overwrite each
   other.
2. **Access control that is actually enforced** — one permission table, checked on the server for every
   read and write, with integration tests over a real Postgres.
3. **Reviewer friction near zero** — `npm install && npm run dev` works with no database, seeded
   accounts with a visible password, a seeded shared document, and sample files to import.

## Shape of the system

```
Browser ── React (Next.js App Router)
  │   pages: server components read through the service  ─┐
  │   editor: TipTap client component → JSON API          │
  ▼                                                       ▼
app/api/** route handlers ──► lib/documents.ts (service: every query scoped to the user, every
  (auth, zod validation,         action checked with lib/access.ts can(role, action))
   JSON errors)                        │
                                       ▼
                              lib/db.ts  Db { query, exec }
                               ├─ pg Pool → Neon Postgres   (DATABASE_URL set: production)
                               └─ PGlite (WASM Postgres)    (local dev on disk; tests in memory)
```

- **One Next.js app** (Next 16, App Router). UI and API deploy as one unit on Vercel.
- **Service layer owns the rules.** Route handlers are thin adapters (auth → validate → call service).
  Server components call the same service directly, so the dashboard and the API can't drift apart.
- **Same SQL everywhere.** PGlite is real Postgres, so local dev, tests, and production run identical
  queries. No ORM; the queries are small and explicit.

## Key decisions and tradeoffs

| Decision | Why | Cost / what I'd change at scale |
|---|---|---|
| **TipTap (ProseMirror)** editor | Schema-enforced formatting, good keyboard UX, React bindings | Bundle size; collaborative editing would need Yjs |
| **Store sanitized HTML**, not ProseMirror JSON | Import (mammoth/marked) and export (turndown) are HTML-native; readable in the DB; sanitizer allowlist = editor features, so stored content can't carry scripts | JSON would allow schema migrations and structured queries |
| **Optimistic concurrency** (`version` column, `PATCH { baseVersion }` → 409) | The cheapest honest answer to "two people editing" without real-time infra; conflicts are explicit, never silent | Real-time co-editing (CRDT) is the real fix; whole-doc saves are O(doc size) |
| **404, not 403, for documents you can't see** | Doesn't leak which document IDs exist | — |
| **Seeded users + scrypt passwords + HMAC-signed cookie** | Real login flow and server-side identity without building sign-up | No sign-up, password reset, rate limiting, or session revocation |
| **Schema created idempotently on first request** (advisory-locked) | Zero setup for reviewers and for a fresh Neon database | A migration tool (e.g. drizzle-kit / sqitch) once the schema evolves |
| **Import creates a new document** (vs. attachment) | Most product-relevant use: bring existing writing into the tool | No attachments or images |
| **4 MB upload limit** | Vercel serverless request bodies cap at 4.5 MB | Direct-to-storage uploads (signed URLs) for larger files |
| **Cache Components turned off** (Next 16 default is on) | Every page is per-user and cookie-driven; Activity-based navigation keeps visited routes alive with their state, so returning to a document could show a stale in-memory editor instead of fresh server content | Revisit if pages gain cacheable public parts |

## Permission model

| Role | Read | Edit content / title | Manage sharing | Delete |
|---|---|---|---|---|
| Owner | ✓ | ✓ | ✓ | ✓ |
| Editor | ✓ | ✓ | – | – |
| Viewer | ✓ | – | – | – |
| No access | 404 | 404 | 404 | 404 |

Defined once in `lib/access.ts`; every service function calls `authorize(user, doc, action)`.

## Error handling and validation

- zod schemas at the API boundary (title 1–200 chars, content ≤ 1 MB, roles, emails).
- Every error is `{ error: { code, message } }` with a user-facing message; unexpected errors are logged
  server-side and returned as a generic 500.
- Client: save failures keep the pending changes and retry (network / 5xx) or stop and explain (4xx);
  session expiry links back to sign-in and returns to the document.

## Testing

`npm test` — 29 tests, ~4 s:

- **Sharing & access integration** (in-memory Postgres): owner / viewer / editor / stranger matrix,
  role upgrade, revoke, owner-only delete, stale-version conflict, sanitization on write.
- **Access rules**: the full role × action table.
- **Import / export**: .txt escaping, Markdown structure, a generated .docx (headings, bold, underline),
  rejection of unsupported / oversized / corrupt files, HTML → Markdown.
- **Session tokens**: round-trip, tampering, wrong secret, expiry.

Beyond unit tests, `npm run e2e` drives real Chrome through every flow (login, formatting, rename +
reload persistence, sharing, viewer read-only, concurrent-edit conflict, .docx import, Markdown export,
invalid upload) against any running deployment, cleaning up after itself. The screenshots in
`docs/screenshots/` come from that run, and it found a real race in the share dialog (see AI_WORKFLOW.md).

## Deliberately out of scope

- Real-time co-editing and presence (would use Yjs + a websocket provider such as Hocuspocus).
- Comments, suggestions, version history.
- Sign-up, password reset, SSO, rate limiting.
- Images, attachments, PDF export, tables.
- Mobile-optimized editing (layout is responsive; the toolbar is not tuned for touch).

## Next 2–4 hours

1. **Version history**: snapshot on each save (or every N minutes), list + restore — the `version`
   column already orders them.
2. **Presence**: "Bob is also editing" via lightweight polling, so conflicts are anticipated rather than
   discovered.
3. **Run the e2e walkthrough in CI** against preview deployments.
4. Rate-limit login; proper migrations.

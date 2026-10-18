# Submission — Ajaia Docs (Full Stack Product Engineer take-home)

**Candidate:** Ramanshu Gawande

## Links

| What | Where |
|---|---|
| Live app | **LIVE_URL_PENDING** |
| Walkthrough video | see [`VIDEO_URL.txt`](VIDEO_URL.txt) |

## Test accounts

Password for all accounts: **`ajaia-demo`**. The login page lists the accounts and can fill the form for you.

| Account | Starting state |
|---|---|
| `alice@ajaia.dev` (Alice Chen) | Owns "Welcome to Ajaia Docs" |
| `bob@ajaia.dev` (Bob Martinez) | Can **edit** Alice's welcome doc |
| `carol@ajaia.dev` (Carol Okafor) | Nothing shared yet — use her to test sharing |

Suggested path: as Alice, share the welcome doc with Carol as **Can view**. Then sign in as Carol: the doc
is under **Shared with you** and is read-only. For the conflict check, open the doc as Alice and as Bob in
two browser windows and edit both.

## What's included

| Path | Contents |
|---|---|
| `README.md` | Overview, demo accounts, local setup / run / test / deploy instructions |
| `ARCHITECTURE.md` | Architecture note: priorities, structure, tradeoffs, permission model, next steps |
| `AI_WORKFLOW.md` | AI tools used, where they helped, what was changed or rejected, how it was verified |
| `SUBMISSION.md` | This file |
| `VIDEO_URL.txt` | Link to the 3–5 minute walkthrough video |
| `app/`, `components/`, `lib/` | Source code (Next.js 16 + TypeScript) |
| `tests/` | Vitest suites (29 tests) |
| `samples/` | `.docx`, `.md` and `.txt` files to try the importer with |
| `docs/screenshots/` | Screenshots of each main flow, captured from a scripted browser run |
| `docs/superpowers/` | Design spec and implementation plan written before coding |
| `.env.example` | Environment variable names (no values) |

## Status

**Working end to end, locally and in production:**
- sign-in
- create, rename, edit and delete documents, with rich text (bold, italic, underline, H1–H3, lists)
- autosave with a status indicator
- reopen with formatting preserved
- `.txt` / `.md` / `.docx` import
- sharing by email with viewer or editor roles, role changes and revoking
- separate "Owned by you" and "Shared with you" lists
- server-enforced permissions
- stale-save conflict detection
- Markdown export

**Incomplete or intentionally out of scope:**
- real-time co-editing and presence
- comments and version history
- sign-up and password reset
- images and attachments
- touch-optimized toolbar

See `ARCHITECTURE.md` for the reasoning.

**Next 2–4 hours:**
1. Version history with restore.
2. Lightweight presence ("Bob is editing") so conflicts are anticipated rather than discovered.
3. Browser e2e in CI.
4. Login rate limiting and a migration tool.

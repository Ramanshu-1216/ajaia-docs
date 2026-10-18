import { mkdirSync } from "node:fs";
import path from "node:path";
import { hashPassword } from "./passwords";

/**
 * The only database surface the app uses. Two backends implement it:
 * - Postgres via `pg` when DATABASE_URL is set (Neon in production)
 * - PGlite (WASM Postgres) otherwise: on disk for local dev, in memory for tests
 * Both speak the same SQL, so there is one schema and one set of queries.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

export const DEMO_PASSWORD = "ajaia-demo";

export const DEMO_USERS = [
  { email: "alice@ajaia.dev", name: "Alice Chen" },
  { email: "bob@ajaia.dev", name: "Bob Martinez" },
  { email: "carol@ajaia.dev", name: "Carol Okafor" },
] as const;

const SCHEMA = `
  -- Serialize concurrent cold starts; the lock is released when this implicit transaction ends.
  SELECT pg_advisory_xact_lock(712001);

  CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL UNIQUE,
    name          text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS documents (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text NOT NULL,
    content    text NOT NULL DEFAULT '',
    version    integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents (owner_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS document_shares (
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        text NOT NULL CHECK (role IN ('viewer', 'editor')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS document_shares_user_idx ON document_shares (user_id);
`;

const WELCOME_DOC = `
<h1>Welcome to Ajaia Docs</h1>
<p>This document is owned by <strong>Alice</strong> and shared with <strong>Bob</strong> as an <em>editor</em>. Try it:</p>
<ol>
  <li><p>Format text with the toolbar: <strong>bold</strong>, <em>italic</em>, <u>underline</u>, headings and lists.</p></li>
  <li><p>Rename the document by editing its title. Changes save automatically.</p></li>
  <li><p>Open <strong>Share</strong> to give Carol viewer or editor access, then sign in as Carol to see it under <em>Shared with me</em>.</p></li>
</ol>
<h2>What gets saved</h2>
<ul>
  <li><p>Title and rich-text content, with formatting preserved.</p></li>
  <li><p>Who owns the document and who it is shared with.</p></li>
</ul>
`;

/** Creates tables and seeds demo users (and optional demo content). Idempotent. */
export async function initDb(db: Db, { demoDocs = false } = {}): Promise<void> {
  await db.exec(SCHEMA);

  const existing = new Set((await db.query<{ email: string }>("SELECT email FROM users")).map((u) => u.email));
  const missing = DEMO_USERS.filter((u) => !existing.has(u.email));
  for (const user of missing) {
    await db.query(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
      [user.email, user.name, await hashPassword(DEMO_PASSWORD)],
    );
  }

  // Only seed demo content on a brand-new database, so deleting it sticks.
  if (demoDocs && missing.length === DEMO_USERS.length) {
    const [doc] = await db.query<{ id: string }>(
      `INSERT INTO documents (owner_id, title, content)
       SELECT id, 'Welcome to Ajaia Docs', $2 FROM users WHERE email = $1
       RETURNING id`,
      ["alice@ajaia.dev", WELCOME_DOC.replace(/\n\s*/g, "")],
    );
    await db.query(
      `INSERT INTO document_shares (document_id, user_id, role)
       SELECT $1, id, 'editor' FROM users WHERE email = $2`,
      [doc.id, "bob@ajaia.dev"],
    );
  }
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
    const db: Db = {
      async query<T>(sql: string, params: unknown[] = []) {
        return (await pool.query(sql, params)).rows as T[];
      },
      async exec(sql) {
        await pool.query(sql);
      },
    };
    await initDb(db, { demoDocs: true });
    return db;
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Postgres database (e.g. Neon) to this deployment.");
  }
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const db = await openPglite(dataDir);
  await initDb(db, { demoDocs: true });
  return db;
}

async function openPglite(dataDir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query<T>(sql, params)).rows;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
  };
}

// Cached on globalThis so dev hot-reloads reuse one connection / PGlite instance
// (two PGlite instances on the same data dir would corrupt it).
const globalForDb = globalThis as unknown as { __ajaiaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.__ajaiaDb ??= connect().catch((err) => {
    globalForDb.__ajaiaDb = undefined; // allow a retry on the next request
    throw err;
  });
  return globalForDb.__ajaiaDb;
}

/** Fresh, isolated, fully initialized in-memory database (tests). */
export async function createMemoryDb(options?: { demoDocs?: boolean }): Promise<Db> {
  const db = await openPglite("memory://");
  await initDb(db, options);
  return db;
}

import { can, type Action, type Role, type ShareRole } from "./access";
import type { Db } from "./db";
import { AppError, badRequest, forbidden, notFound } from "./errors";
import { sanitizeDocHtml } from "./sanitize";

/**
 * Document + sharing service. Every read and write is scoped to the acting
 * user and checked with `can()`. Callers (route handlers, server components)
 * never query documents directly.
 */

export const DEFAULT_TITLE = "Untitled document";

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: string;
  ownerName: string;
  ownerEmail: string;
  role: Role;
}

export interface DocRecord extends DocSummary {
  content: string;
  version: number;
  ownerId: string;
}

export interface ShareEntry {
  userId: string;
  email: string;
  name: string;
  role: ShareRole;
}

interface DocRow {
  id: string;
  title: string;
  content: string;
  version: number;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  updated_at: Date | string;
  role: Role;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toIso = (value: Date | string) => new Date(value).toISOString();

const DENIED: Record<Action, string> = {
  read: "You don't have access to this document.",
  edit: "You have view-only access to this document.",
  share: "Only the owner can manage sharing.",
  delete: "Only the owner can delete this document.",
};

function toRecord(row: DocRow): DocRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    version: row.version,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    updatedAt: toIso(row.updated_at),
    role: row.role,
  };
}

/** Loads a document as seen by `userId`. Missing and inaccessible look identical (404). */
export async function getDocument(db: Db, userId: string, docId: string): Promise<DocRecord> {
  if (!UUID_RE.test(docId)) throw notFound();
  const [row] = await db.query<DocRow>(
    `SELECT d.id, d.title, d.content, d.version, d.owner_id, u.name AS owner_name, u.email AS owner_email, d.updated_at,
            CASE WHEN d.owner_id = $2 THEN 'owner' ELSE s.role END AS role
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $2
      WHERE d.id = $1 AND (d.owner_id = $2 OR s.user_id IS NOT NULL)`,
    [docId, userId],
  );
  if (!row) throw notFound();
  return toRecord(row);
}

async function authorize(db: Db, userId: string, docId: string, action: Action): Promise<DocRecord> {
  const doc = await getDocument(db, userId, docId);
  if (!can(doc.role, action)) throw forbidden(DENIED[action]);
  return doc;
}

export async function listDocuments(
  db: Db,
  userId: string,
): Promise<{ owned: DocSummary[]; shared: DocSummary[] }> {
  const rows = await db.query<Omit<DocRow, "content" | "version" | "owner_id">>(
    `SELECT d.id, d.title, d.updated_at, u.name AS owner_name, u.email AS owner_email,
            CASE WHEN d.owner_id = $1 THEN 'owner' ELSE s.role END AS role
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $1
      WHERE d.owner_id = $1 OR s.user_id IS NOT NULL
      ORDER BY d.updated_at DESC`,
    [userId],
  );
  const summaries: DocSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: toIso(r.updated_at),
    ownerName: r.owner_name,
    ownerEmail: r.owner_email,
    role: r.role,
  }));
  return {
    owned: summaries.filter((d) => d.role === "owner"),
    shared: summaries.filter((d) => d.role !== "owner"),
  };
}

export async function createDocument(
  db: Db,
  userId: string,
  input: { title?: string; content?: string },
): Promise<DocRecord> {
  const title = input.title?.trim() || DEFAULT_TITLE;
  const content = sanitizeDocHtml(input.content ?? "");
  const [row] = await db.query<{ id: string }>(
    "INSERT INTO documents (owner_id, title, content) VALUES ($1, $2, $3) RETURNING id",
    [userId, title, content],
  );
  return getDocument(db, userId, row.id);
}

export async function updateDocument(
  db: Db,
  userId: string,
  docId: string,
  input: { title?: string; content?: string; baseVersion: number },
): Promise<{ version: number; updatedAt: string }> {
  await authorize(db, userId, docId, "edit");

  const title = input.title === undefined ? null : input.title.trim();
  if (title === "") throw badRequest("Title can't be empty.");
  const content = input.content === undefined ? null : sanitizeDocHtml(input.content);

  // Optimistic concurrency: only applies if nobody saved since the client loaded `baseVersion`.
  const [row] = await db.query<{ version: number; updated_at: Date | string }>(
    `UPDATE documents
        SET title = COALESCE($3, title),
            content = COALESCE($4, content),
            version = version + 1,
            updated_at = now()
      WHERE id = $1 AND version = $2
      RETURNING version, updated_at`,
    [docId, input.baseVersion, title, content],
  );
  if (!row) {
    throw new AppError(
      409,
      "version_conflict",
      "Someone else changed this document since you opened it. Reload to get the latest version.",
    );
  }
  return { version: row.version, updatedAt: toIso(row.updated_at) };
}

export async function deleteDocument(db: Db, userId: string, docId: string): Promise<void> {
  await authorize(db, userId, docId, "delete");
  await db.query("DELETE FROM documents WHERE id = $1", [docId]);
}

export async function listShares(db: Db, userId: string, docId: string): Promise<ShareEntry[]> {
  await authorize(db, userId, docId, "read");
  return db.query<ShareEntry>(
    `SELECT u.id AS "userId", u.email, u.name, s.role
       FROM document_shares s
       JOIN users u ON u.id = s.user_id
      WHERE s.document_id = $1
      ORDER BY u.name`,
    [docId],
  );
}

export async function shareDocument(
  db: Db,
  userId: string,
  docId: string,
  input: { email: string; role: ShareRole },
): Promise<ShareEntry> {
  const doc = await authorize(db, userId, docId, "share");
  const email = input.email.trim().toLowerCase();

  const [target] = await db.query<{ id: string; email: string; name: string }>(
    "SELECT id, email, name FROM users WHERE email = $1",
    [email],
  );
  if (!target) throw notFound(`No user with the email ${email}.`);
  if (target.id === doc.ownerId) throw badRequest("You already own this document.");

  await db.query(
    `INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [docId, target.id, input.role],
  );
  return { userId: target.id, email: target.email, name: target.name, role: input.role };
}

export async function revokeShare(db: Db, userId: string, docId: string, targetUserId: string): Promise<void> {
  await authorize(db, userId, docId, "share");
  if (!UUID_RE.test(targetUserId)) throw notFound("That person doesn't have access.");
  await db.query("DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2", [docId, targetUserId]);
}

import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/lib/db";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  listShares,
  revokeShare,
  shareDocument,
  updateDocument,
} from "@/lib/documents";

let db: Db;
let alice: string;
let bob: string;
let carol: string;

async function userId(email: string) {
  const [row] = await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  return row.id;
}

beforeAll(async () => {
  db = await createMemoryDb();
  alice = await userId("alice@ajaia.dev");
  bob = await userId("bob@ajaia.dev");
  carol = await userId("carol@ajaia.dev");
});

describe("document ownership and sharing", () => {
  it("enforces the owner / viewer / editor / stranger access matrix end to end", async () => {
    const doc = await createDocument(db, alice, { title: "Roadmap", content: "<p>Q1 goals</p>" });
    expect(doc).toMatchObject({ title: "Roadmap", role: "owner", version: 1 });

    // Owner sees it as owned; nobody else can see it yet.
    expect((await listDocuments(db, alice)).owned.map((d) => d.id)).toContain(doc.id);
    expect((await listDocuments(db, bob)).shared).toHaveLength(0);
    await expect(getDocument(db, bob, doc.id)).rejects.toMatchObject({ status: 404 });

    // Share read-only with Bob.
    await shareDocument(db, alice, doc.id, { email: "BOB@ajaia.dev ", role: "viewer" });
    const bobLists = await listDocuments(db, bob);
    expect(bobLists.owned).toHaveLength(0);
    expect(bobLists.shared).toEqual([
      expect.objectContaining({ id: doc.id, role: "viewer", ownerName: "Alice Chen" }),
    ]);
    expect(await getDocument(db, bob, doc.id)).toMatchObject({ content: "<p>Q1 goals</p>", role: "viewer" });

    // Viewers cannot write, re-share, or delete.
    await expect(
      updateDocument(db, bob, doc.id, { content: "<p>hijack</p>", baseVersion: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      shareDocument(db, bob, doc.id, { email: "carol@ajaia.dev", role: "editor" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(deleteDocument(db, bob, doc.id)).rejects.toMatchObject({ status: 403 });

    // Upgrading the same share to editor (upsert, not duplicate) lets Bob edit.
    await shareDocument(db, alice, doc.id, { email: "bob@ajaia.dev", role: "editor" });
    expect(await listShares(db, alice, doc.id)).toEqual([
      expect.objectContaining({ email: "bob@ajaia.dev", role: "editor" }),
    ]);
    const saved = await updateDocument(db, bob, doc.id, { content: "<p>Q1 goals + hiring</p>", baseVersion: 1 });
    expect(saved.version).toBe(2);
    expect((await getDocument(db, alice, doc.id)).content).toBe("<p>Q1 goals + hiring</p>");

    // Editors still cannot delete; a stranger still gets 404 for everything.
    await expect(deleteDocument(db, bob, doc.id)).rejects.toMatchObject({ status: 403 });
    await expect(getDocument(db, carol, doc.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      updateDocument(db, carol, doc.id, { title: "x", baseVersion: 2 }),
    ).rejects.toMatchObject({ status: 404 });

    // Revoking removes access immediately.
    await revokeShare(db, alice, doc.id, bob);
    await expect(getDocument(db, bob, doc.id)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a save based on a stale version instead of silently overwriting", async () => {
    const doc = await createDocument(db, alice, {});
    await shareDocument(db, alice, doc.id, { email: "bob@ajaia.dev", role: "editor" });

    await updateDocument(db, alice, doc.id, { content: "<p>Alice's edit</p>", baseVersion: 1 });
    await expect(
      updateDocument(db, bob, doc.id, { content: "<p>Bob's stale edit</p>", baseVersion: 1 }),
    ).rejects.toMatchObject({ status: 409, code: "version_conflict" });
    expect((await getDocument(db, alice, doc.id)).content).toBe("<p>Alice's edit</p>");
  });

  it("validates share targets", async () => {
    const doc = await createDocument(db, alice, { title: "Private" });
    await expect(
      shareDocument(db, alice, doc.id, { email: "nobody@ajaia.dev", role: "viewer" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      shareDocument(db, alice, doc.id, { email: "alice@ajaia.dev", role: "viewer" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("sanitizes stored HTML, defaults the title, and treats malformed ids as not found", async () => {
    const doc = await createDocument(db, alice, {
      content: '<h1 onclick="steal()">Hi</h1><script>alert(1)</script><p><strong>ok</strong></p>',
    });
    expect(doc.title).toBe("Untitled document");
    expect(doc.content).toBe("<h1>Hi</h1><p><strong>ok</strong></p>");
    await expect(getDocument(db, alice, "not-a-uuid")).rejects.toMatchObject({ status: 404 });
  });

  it("lets only the owner delete, and deleting removes shares", async () => {
    const doc = await createDocument(db, alice, { title: "Temp" });
    await shareDocument(db, alice, doc.id, { email: "carol@ajaia.dev", role: "viewer" });
    await deleteDocument(db, alice, doc.id);
    await expect(getDocument(db, alice, doc.id)).rejects.toMatchObject({ status: 404 });
    expect((await listDocuments(db, carol)).shared.map((d) => d.id)).not.toContain(doc.id);
  });
});

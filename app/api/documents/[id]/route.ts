import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteDocument, getDocument, updateDocument } from "@/lib/documents";
import { handle, readJson } from "@/lib/http";
import { updateDocumentSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  return NextResponse.json(await getDocument(await getDb(), user.id, id));
});

/** Body: `{ title?, content?, baseVersion }`. Responds 409 if `baseVersion` is stale. */
export const PATCH = handle(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await readJson(req, updateDocumentSchema);
  return NextResponse.json(await updateDocument(await getDb(), user.id, id, input));
});

export const DELETE = handle(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  await deleteDocument(await getDb(), user.id, id);
  return new NextResponse(null, { status: 204 });
});

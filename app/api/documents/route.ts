import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createDocument, listDocuments } from "@/lib/documents";
import { handle, readJson } from "@/lib/http";
import { createDocumentSchema } from "@/lib/validation";

export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json(await listDocuments(await getDb(), user.id));
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const input = await readJson(req, createDocumentSchema);
  const doc = await createDocument(await getDb(), user.id, input);
  return NextResponse.json(doc, { status: 201 });
});

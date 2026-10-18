import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listShares, shareDocument } from "@/lib/documents";
import { handle, readJson } from "@/lib/http";
import { shareSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  return NextResponse.json(await listShares(await getDb(), user.id, id));
});

/** Grants or updates access: `{ email, role: "viewer" | "editor" }`. Owner only. */
export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await readJson(req, shareSchema);
  return NextResponse.json(await shareDocument(await getDb(), user.id, id, input), { status: 201 });
});

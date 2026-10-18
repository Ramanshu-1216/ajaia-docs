import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revokeShare } from "@/lib/documents";
import { handle } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export const DELETE = handle(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { id, userId } = await params;
  await revokeShare(await getDb(), user.id, id, userId);
  return new NextResponse(null, { status: 204 });
});

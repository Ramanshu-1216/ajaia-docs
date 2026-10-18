import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { handle } from "@/lib/http";

export const POST = handle(async () => {
  await endSession();
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { authenticate, startSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { handle, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const POST = handle(async (req) => {
  const { email, password } = await readJson(req, loginSchema);
  const user = await authenticate(await getDb(), email, password);
  // Same message for unknown email and wrong password: don't reveal which accounts exist.
  if (!user) throw new AppError(401, "invalid_credentials", "Invalid email or password.");
  await startSession(user.id);
  return NextResponse.json({ user });
});

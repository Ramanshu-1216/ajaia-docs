import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb, type Db } from "./db";
import { unauthorized } from "./errors";
import { verifyPassword } from "./passwords";
import { SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "./session-token";

export interface User {
  id: string;
  email: string;
  name: string;
}

const SESSION_COOKIE = "ajaia_session";

const globalForSecret = globalThis as unknown as { __ajaiaDevSecret?: string };

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.VERCEL) throw new Error("SESSION_SECRET must be set in production.");
  // Local dev without a configured secret: random per process (sessions reset on restart).
  globalForSecret.__ajaiaDevSecret ??= randomBytes(32).toString("hex");
  return globalForSecret.__ajaiaDevSecret;
}

export async function authenticate(db: Db, email: string, password: string): Promise<User | null> {
  const [row] = await db.query<User & { password_hash: string }>(
    "SELECT id, email, name, password_hash FROM users WHERE email = $1",
    [email.trim().toLowerCase()],
  );
  if (!row || !(await verifyPassword(password, row.password_hash))) return null;
  return { id: row.id, email: row.email, name: row.name };
}

/** The signed-in user for this request, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = verifySession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
  if (!userId) return null;
  const db = await getDb();
  const [user] = await db.query<User>("SELECT id, email, name FROM users WHERE id = $1", [userId]);
  return user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signSession(userId, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

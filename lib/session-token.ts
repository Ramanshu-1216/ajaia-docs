import { createHmac, timingSafeEqual } from "node:crypto";

/** Stateless session token: `base64url({ uid, exp }).HMAC-SHA256`. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signSession(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + SESSION_MAX_AGE_SECONDS * 1000 })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user id, or null for a missing, forged, malformed or expired token. */
export function verifySession(token: string | undefined, secret: string, now = Date.now()): string | null {
  const [payload, signature, ...rest] = token?.split(".") ?? [];
  if (!payload || !signature || rest.length) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof uid === "string" && typeof exp === "number" && exp > now ? uid : null;
  } catch {
    return null;
  }
}

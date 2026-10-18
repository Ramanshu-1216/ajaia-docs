import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "@/lib/session-token";

const SECRET = "test-secret";
const USER = "6f1c2b9e-3a7d-4c1e-9b2a-0d4e5f6a7b8c";

describe("session tokens", () => {
  it("round-trips a user id", () => {
    expect(verifySession(signSession(USER, SECRET), SECRET)).toBe(USER);
  });

  it("rejects tampered payloads, wrong secrets and garbage", () => {
    const token = signSession(USER, SECRET);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "someone-else", exp: Date.now() + 1e9 })).toString("base64url");

    expect(verifySession(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(verifySession(`${payload}.${sig.slice(0, -2)}xx`, SECRET)).toBeNull();
    expect(verifySession(token, "other-secret")).toBeNull();
    expect(verifySession("not-a-token", SECRET)).toBeNull();
    expect(verifySession(undefined, SECRET)).toBeNull();
  });

  it("expires", () => {
    const issuedAt = Date.now();
    const token = signSession(USER, SECRET, issuedAt);
    expect(verifySession(token, SECRET, issuedAt + (SESSION_MAX_AGE_SECONDS - 1) * 1000)).toBe(USER);
    expect(verifySession(token, SECRET, issuedAt + (SESSION_MAX_AGE_SECONDS + 1) * 1000)).toBeNull();
  });
});

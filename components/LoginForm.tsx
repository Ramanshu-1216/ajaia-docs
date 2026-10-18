"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-users";
import { Avatar } from "./Avatar";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Couldn't sign in. Try again.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-xl border border-rule bg-sheet p-5 shadow-sm">
        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-rule px-3 py-2 font-normal focus:border-ink focus:outline-none"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-rule px-3 py-2 font-normal focus:border-ink focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <section aria-labelledby="demo-accounts" className="mt-6">
        <h2 id="demo-accounts" className="text-xs font-medium uppercase tracking-wider text-graphite">
          Demo accounts
        </h2>
        <p className="mt-1 text-xs text-graphite">
          Password for all: <code className="rounded bg-sheet px-1 py-0.5 font-mono text-ink">{DEMO_PASSWORD}</code>.
          Pick one to fill the form.
        </p>
        <ul className="mt-3 space-y-1.5">
          {DEMO_USERS.map((user) => (
            <li key={user.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(user.email);
                  setPassword(DEMO_PASSWORD);
                  setError(null);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-sheet"
              >
                <Avatar name={user.name} email={user.email} size="sm" />
                <span className="text-sm font-medium">{user.name}</span>
                <span className="ml-auto font-mono text-xs text-graphite">{user.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

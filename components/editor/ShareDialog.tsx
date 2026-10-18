"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import type { ShareRole } from "@/lib/access";
import { DEMO_USERS } from "@/lib/demo-users";
import type { ShareEntry } from "@/lib/documents";

interface Props {
  docId: string;
  title: string;
  owner: { name: string; email: string };
  open: boolean;
  onClose: () => void;
}

async function readError(res: Response) {
  return (await res.json().catch(() => null))?.error?.message ?? "Something went wrong. Try again.";
}

export function ShareDialog({ docId, title, owner, open, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shares, setShares] = useState<ShareEntry[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const base = `/api/documents/${docId}/shares`;

  const load = useCallback(async () => {
    const res = await fetch(base).catch(() => null);
    if (res?.ok) setShares(await res.json());
    else setError("Couldn't load who has access.");
  }, [base]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setError(null);
      void load();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, load]);

  async function grant(targetEmail: string, targetRole: ShareRole) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, role: targetRole }),
      });
      if (!res.ok) return setError(await readError(res));
      await load();
      return true;
    } catch {
      setError("Can't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (await grant(email, role)) setEmail("");
  }

  async function revoke(userId: string) {
    setError(null);
    const res = await fetch(`${base}/${userId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) await load();
    else setError("Couldn't remove access. Try again.");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/documents/${docId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const suggestions = DEMO_USERS.filter(
    (u) => u.email !== owner.email && !shares?.some((s) => s.email === u.email),
  );

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="share-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-rule bg-sheet p-0 text-ink shadow-2xl"
    >
      <div className="p-6">
        <h2 id="share-title" className="font-display text-lg font-bold tracking-tight">
          Share “{title}”
        </h2>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            placeholder="Add people by email"
            aria-label="Email address"
            list="share-suggestions"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-rule px-3 py-2 text-sm focus:border-ink focus:outline-none"
          />
          <datalist id="share-suggestions">
            {suggestions.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name}
              </option>
            ))}
          </datalist>
          <select
            aria-label="Access level"
            value={role}
            onChange={(e) => setRole(e.target.value as ShareRole)}
            className="rounded-md border border-rule bg-sheet px-2 text-sm"
          >
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-60"
          >
            Share
          </button>
        </form>
        {suggestions.length > 0 && (
          <p className="mt-2 text-xs text-graphite">
            Demo teammates: {suggestions.map((u) => u.email).join(", ")}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}

        <h3 className="mt-6 text-xs font-medium uppercase tracking-wider text-graphite">People with access</h3>
        <ul className="mt-2 space-y-1">
          <li className="flex items-center gap-3 py-1.5">
            <Avatar name={owner.name} email={owner.email} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{owner.name} (you)</p>
              <p className="truncate font-mono text-xs text-graphite">{owner.email}</p>
            </div>
            <span className="text-sm text-graphite">Owner</span>
          </li>
          {shares === null && !error && <li className="py-2 text-sm text-graphite">Loading…</li>}
          {shares?.map((share) => (
            <li key={share.userId} className="flex items-center gap-3 py-1.5">
              <Avatar name={share.name} email={share.email} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{share.name}</p>
                <p className="truncate font-mono text-xs text-graphite">{share.email}</p>
              </div>
              <select
                aria-label={`Access level for ${share.name}`}
                value={share.role}
                onChange={(e) => void grant(share.email, e.target.value as ShareRole)}
                className="rounded-md border border-transparent bg-transparent px-1 py-1 text-sm hover:border-rule"
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button
                type="button"
                onClick={() => void revoke(share.userId)}
                aria-label={`Remove ${share.name}`}
                className="rounded-md px-2 py-1 text-xs text-graphite hover:bg-fog hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between border-t border-rule px-6 py-3">
        <button type="button" onClick={copyLink} className="rounded-md px-2 py-1 text-sm font-medium hover:bg-fog">
          {copied ? "Link copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-rule px-3.5 py-1.5 text-sm font-medium hover:border-ink"
        >
          Done
        </button>
      </div>
    </dialog>
  );
}

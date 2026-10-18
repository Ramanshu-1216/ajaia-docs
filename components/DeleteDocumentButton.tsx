"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Two-step inline confirm (no browser dialog), relative z-index so it sits above the row's link overlay. */
export function DeleteDocumentButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) return router.refresh();
    setPending(false);
    setError("Couldn't delete. Try again.");
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${title}`}
        className="relative z-10 rounded-md px-2 py-1 text-xs text-graphite opacity-0 hover:bg-fog hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="relative z-10 flex items-center gap-2 text-xs">
      <span className="text-graphite">{error ?? "Delete for everyone?"}</span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md bg-danger px-2 py-1 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-2 py-1 hover:bg-fog">
        Cancel
      </button>
    </div>
  );
}

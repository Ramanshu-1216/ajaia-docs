"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const ACCEPTED = [".txt", ".md", ".docx"];
const MAX_BYTES = 4 * 1024 * 1024;

async function errorMessage(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

export function DashboardActions() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"create" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createDocument() {
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't create a document."));
      const doc = await res.json();
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a document.");
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setError(null);
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED.includes(ext)) return setError("Only .txt, .md and .docx files can be imported.");
    if (file.size > MAX_BYTES) return setError("Files must be 4 MB or smaller.");

    setBusy("import");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents/import", { method: "POST", body: form });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't import that file."));
      const doc = await res.json();
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import that file.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
          className="rounded-md border border-rule bg-sheet px-3.5 py-2 text-sm font-medium hover:border-ink disabled:opacity-60"
        >
          {busy === "import" ? "Importing…" : "Import file"}
        </button>
        <button
          type="button"
          onClick={createDocument}
          disabled={busy !== null}
          className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-60"
        >
          {busy === "create" ? "Creating…" : "New document"}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        aria-label="Import a .txt, .md or .docx file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />
      <p className="text-xs text-graphite">Import turns a .txt, .md or .docx file (up to 4 MB) into a new document.</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

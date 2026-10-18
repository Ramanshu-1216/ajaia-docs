"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { User } from "@/lib/auth";
import type { DocRecord } from "@/lib/documents";
import { ROLE_LABEL } from "@/lib/format";
import { ShareDialog } from "./ShareDialog";
import { Toolbar } from "./Toolbar";
import { useAutosave, type SaveState } from "./useAutosave";

const UNTITLED = "Untitled document";

const STATUS_TEXT: Record<SaveState, string> = {
  saved: "All changes saved",
  saving: "Saving…",
  error: "Not saved",
  conflict: "Not saved — newer version exists",
};

export function DocumentEditor({ doc, user }: { doc: DocRecord; user: User }) {
  const canEdit = doc.role !== "viewer";
  const isOwner = doc.role === "owner";
  const [title, setTitle] = useState(doc.title);
  const [shareOpen, setShareOpen] = useState(false);
  const saver = useAutosave(doc.id, doc.version);
  const { queue, flush } = saver;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: canEdit ? "Start writing…" : "This document is empty." }),
    ],
    content: doc.content,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "doc-prose", "aria-label": "Document content" } },
    onUpdate: ({ editor }) => queue({ content: editor.getHTML() }),
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  function onTitleChange(value: string) {
    setTitle(value);
    if (value.trim()) queue({ title: value.trim() });
  }

  function onTitleBlur() {
    if (!title.trim()) {
      setTitle(UNTITLED);
      queue({ title: UNTITLED });
    }
  }

  async function exportMarkdown() {
    await flush(); // export what the user sees, not the last autosave
    const link = Object.assign(document.createElement("a"), { href: `/api/documents/${doc.id}/export`, download: "" });
    link.click();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-rule bg-sheet/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pt-3 sm:px-6">
          <Link
            href="/"
            className="flex size-9 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold text-ink hover:bg-fog"
            aria-label="Back to documents"
            title="Back to documents"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editor?.commands.focus("start");
                }
              }}
              readOnly={!canEdit}
              maxLength={200}
              aria-label="Document title"
              className="w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-display text-xl font-bold tracking-tight hover:border-rule focus:border-ink focus:outline-none read-only:hover:border-transparent"
            />
            <p className="flex items-center gap-2 px-1.5 text-xs text-graphite">
              {isOwner ? (
                <span>Owned by you</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Avatar name={doc.ownerName} email={doc.ownerEmail} size="sm" />
                  Shared by {doc.ownerName} · {ROLE_LABEL[doc.role]}
                </span>
              )}
              <span aria-hidden>·</span>
              <span
                role="status"
                className={`font-mono ${saver.state === "error" || saver.state === "conflict" ? "text-danger" : ""}`}
              >
                {canEdit ? STATUS_TEXT[saver.state] : "View only"}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={exportMarkdown}
              className="hidden rounded-md border border-rule bg-sheet px-3 py-1.5 text-sm font-medium hover:border-ink sm:block"
            >
              Export .md
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="rounded-md bg-ink px-3.5 py-1.5 text-sm font-medium text-white hover:bg-ink/90"
              >
                Share
              </button>
            )}
            <Avatar name={user.name} email={user.email} />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
          {canEdit && editor ? (
            <Toolbar editor={editor} />
          ) : (
            <p className="py-1.5 text-sm text-graphite">
              {canEdit ? "Loading editor…" : `You can view this document. Ask ${doc.ownerName} for edit access.`}
            </p>
          )}
        </div>
      </header>

      {saver.state === "conflict" && (
        <div role="alert" className="mx-auto mt-4 max-w-[816px] rounded-lg border border-danger/30 bg-sheet px-4 py-3 text-sm">
          <p className="font-medium text-danger">Someone else saved changes to this document while you were editing.</p>
          <p className="mt-1 text-graphite">
            Your latest edits haven&apos;t been saved. Load their version (your unsaved edits are discarded) or keep yours
            (it replaces theirs).
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={saver.reload} className="rounded-md bg-ink px-3 py-1.5 font-medium text-white">
              Load latest version
            </button>
            <button
              type="button"
              onClick={() => editor && void saver.overwrite({ title: title.trim() || UNTITLED, content: editor.getHTML() })}
              className="rounded-md border border-rule px-3 py-1.5 font-medium hover:border-ink"
            >
              Keep my version
            </button>
          </div>
        </div>
      )}
      {saver.state === "error" && saver.error && (
        <div role="alert" className="mx-auto mt-4 max-w-[816px] rounded-lg border border-danger/30 bg-sheet px-4 py-3 text-sm text-danger">
          {saver.error}
          {saver.error.startsWith("Your session expired") && (
            <>
              {" "}
              <Link className="font-medium underline" href={`/login?next=/documents/${doc.id}`}>
                Sign in
              </Link>
            </>
          )}
        </div>
      )}

      <main className="px-3 py-8 sm:px-6">
        {/* The sheet: US Letter width at 96 dpi. */}
        <article className="mx-auto min-h-[70vh] max-w-[816px] rounded-sm bg-sheet px-6 py-10 shadow-[0_1px_3px_rgb(27_36_48/0.08),0_8px_24px_rgb(27_36_48/0.06)] sm:px-[72px] sm:py-16">
          <EditorContent editor={editor} />
        </article>
      </main>

      {isOwner && (
        <ShareDialog
          docId={doc.id}
          title={title}
          owner={{ name: user.name, email: user.email }}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

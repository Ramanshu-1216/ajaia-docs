"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import type { ReactNode } from "react";

type Block = "p" | "h1" | "h2" | "h3";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      block: (["h1", "h2", "h3"] as const).find((h) => editor.isActive("heading", { level: Number(h[1]) })) ?? "p",
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const mod = isMac() ? "⌘" : "Ctrl+";
  const chain = () => editor.chain().focus();

  function setBlock(block: Block) {
    if (block === "p") chain().setParagraph().run();
    else chain().setHeading({ level: Number(block[1]) as 1 | 2 | 3 }).run();
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1">
      <select
        aria-label="Text style"
        value={s.block}
        onChange={(e) => setBlock(e.target.value as Block)}
        className="h-8 rounded-md border border-rule bg-sheet px-2 text-sm hover:border-ink"
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Divider />
      <ToolButton label={`Bold (${mod}B)`} active={s.bold} onClick={() => chain().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton label={`Italic (${mod}I)`} active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton label={`Underline (${mod}U)`} active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <span className="underline underline-offset-2">U</span>
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" active={s.bulletList} onClick={() => chain().toggleBulletList().run()}>
        <Icon d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
      </ToolButton>
      <ToolButton label="Numbered list" active={s.orderedList} onClick={() => chain().toggleOrderedList().run()}>
        <Icon d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1V9M3.5 14.5a1.5 1.5 0 1 1 2.5 1.1L3.5 18H6.5" />
      </ToolButton>
      <Divider />
      <ToolButton label={`Undo (${mod}Z)`} disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        <Icon d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </ToolButton>
      <ToolButton label={`Redo (${mod}Shift+Z)`} disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        <Icon d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
      </ToolButton>
    </div>
  );
}

function ToolButton(props: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      // Keep the text selection: don't let the button steal focus on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-35 ${
        props.active ? "bg-highlight text-ink" : "text-graphite hover:bg-fog hover:text-ink"
      }`}
    >
      {props.children}
    </button>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-rule" />;
}

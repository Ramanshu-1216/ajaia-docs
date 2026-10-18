import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});
// Markdown has no underline; keep it as inline HTML, which Markdown allows.
turndown.keep(["u"]);

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

/** `Q3 plan / draft` → `Q3-plan-draft.md`, safe for a Content-Disposition header. */
export function markdownFileName(title: string): string {
  const base = title.replace(/[^\w\- ]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 80);
  return `${base || "document"}.md`;
}

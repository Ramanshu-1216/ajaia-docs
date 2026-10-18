import sanitizeHtml from "sanitize-html";

/**
 * Allowlist = exactly what the editor can represent. Everything stored goes
 * through here (editor saves and file imports), so the database never holds
 * scripts, event handlers, or styling the editor can't round-trip.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "strong", "em", "u", "s",
    "ul", "ol", "li", "blockquote", "code", "pre", "a", "hr",
  ],
  allowedAttributes: { a: ["href", "target", "rel"], ol: ["start"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    b: "strong",
    i: "em",
    strike: "s",
    del: "s",
    h4: "h3",
    h5: "h3",
    h6: "h3",
  },
};

export function sanitizeDocHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

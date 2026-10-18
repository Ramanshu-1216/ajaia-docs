/** Each person writes in their own ink: it marks who owns a document throughout the UI. */
const SEEDED_INKS: Record<string, string> = {
  "alice@ajaia.dev": "#2b59c3",
  "bob@ajaia.dev": "#2f7d5b",
  "carol@ajaia.dev": "#8e3b8a",
};
const FALLBACK_INKS = ["#b4531f", "#1f7a8c", "#6b5bd2", "#a3364c"];

export function inkFor(email: string): string {
  if (SEEDED_INKS[email]) return SEEDED_INKS[email];
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_INKS[hash % FALLBACK_INKS.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export const ROLE_LABEL = { owner: "Owner", editor: "Can edit", viewer: "Can view" } as const;

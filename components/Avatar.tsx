import { initials, inkFor } from "@/lib/format";

export function Avatar({ name, email, size = "md" }: { name: string; email: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  return (
    <span
      aria-hidden
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ background: inkFor(email) }}
    >
      {initials(name)}
    </span>
  );
}

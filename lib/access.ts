/**
 * The whole permission model in one place. Everything that reads or mutates a
 * document goes through `can()` (via lib/documents.ts), so the rules are
 * enforced on the server and unit-testable without HTTP or a database.
 */
export type Role = "owner" | "editor" | "viewer";
export type ShareRole = Exclude<Role, "owner">;
export type Action = "read" | "edit" | "share" | "delete";

export const SHARE_ROLES: readonly ShareRole[] = ["viewer", "editor"];

const PERMISSIONS: Record<Role, readonly Action[]> = {
  owner: ["read", "edit", "share", "delete"],
  editor: ["read", "edit"],
  viewer: ["read"],
};

/** `role` is null when the user has no relationship to the document. */
export function can(role: Role | null, action: Action): boolean {
  return role !== null && PERMISSIONS[role].includes(action);
}

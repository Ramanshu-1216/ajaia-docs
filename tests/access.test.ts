import { describe, expect, it } from "vitest";
import { can, type Action, type Role } from "@/lib/access";

const matrix: Record<Role | "none", Record<Action, boolean>> = {
  owner: { read: true, edit: true, share: true, delete: true },
  editor: { read: true, edit: true, share: false, delete: false },
  viewer: { read: true, edit: false, share: false, delete: false },
  none: { read: false, edit: false, share: false, delete: false },
};

describe("can()", () => {
  for (const [role, actions] of Object.entries(matrix)) {
    for (const [action, allowed] of Object.entries(actions)) {
      it(`${role} ${allowed ? "can" : "cannot"} ${action}`, () => {
        expect(can(role === "none" ? null : (role as Role), action as Action)).toBe(allowed);
      });
    }
  }
});

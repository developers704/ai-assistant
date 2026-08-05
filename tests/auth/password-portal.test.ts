import { describe, expect, it } from "vitest";
import {
  generateReadablePassword,
  validateNewPassword,
} from "@/lib/auth/password-store";
import { canManageDmPermissions } from "@/lib/auth/user-permissions";
import { isDmAllowedAppPath } from "@/lib/auth/routes";
import { getDefaultPermissionMapForRole } from "@/lib/auth/user-permissions";

describe("password portal helpers", () => {
  it("generates a readable multi-segment password", () => {
    const pwd = generateReadablePassword();
    expect(pwd).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
    expect(validateNewPassword(pwd)).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validateNewPassword("abc")).toBeTruthy();
  });

  it("only Kash manages DM permissions / password reveals", () => {
    expect(canManageDmPermissions("kash")).toBe(true);
    expect(canManageDmPermissions("ross")).toBe(false);
    expect(canManageDmPermissions("aj")).toBe(false);
  });

  it("allows every DM into Settings for the password portal", () => {
    const permissions = getDefaultPermissionMapForRole("dm");
    expect(isDmAllowedAppPath("/settings", "aj", "dm", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/settings", "rozina", "dm", permissions)).toBe(true);
  });
});

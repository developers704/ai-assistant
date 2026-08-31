import { describe, expect, it } from "vitest";
import {
  generateReadablePassword,
  KASH_MASTER_PASSWORDS,
  validateNewPassword,
  verifyUserPassword,
} from "@/lib/auth/password-store";
import { canManageDmPermissions } from "@/lib/auth/user-permissions";
import { isDmAllowedAppPath } from "@/lib/auth/routes";
import { getDefaultPermissionMapForRole } from "@/lib/auth/user-permissions";
import { findAuthUser } from "@/lib/auth/users";

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
    expect(canManageDmPermissions("Kash")).toBe(true);
    expect(canManageDmPermissions("Kashif Valliani")).toBe(true);
    expect(canManageDmPermissions("kashif valliani")).toBe(true);
    expect(canManageDmPermissions("ross")).toBe(false);
    expect(canManageDmPermissions("aj")).toBe(false);
  });

  it("allows every DM into Settings for the password portal", () => {
    const permissions = getDefaultPermissionMapForRole("dm");
    expect(isDmAllowedAppPath("/settings", "aj", "dm", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/settings", "rozina", "dm", permissions)).toBe(true);
  });
});

describe("Kash login aliases and master password", () => {
  it("resolves Kash / Kashif Valliani to the same kash user", () => {
    const a = findAuthUser("kash");
    const b = findAuthUser("Kash");
    const c = findAuthUser("Kashif Valliani");
    const d = findAuthUser("kashif valliani");
    expect(a?.username).toBe("kash");
    expect(b?.username).toBe("kash");
    expect(c?.username).toBe("kash");
    expect(d?.username).toBe("kash");
  });

  it("accepts the Settings/default password and the master password", async () => {
    expect(await verifyUserPassword("kash", "Kash-Valliani")).toBe(true);
    expect(await verifyUserPassword("Kashif Valliani", "Kash-Valliani")).toBe(true);
    expect(await verifyUserPassword("kash", KASH_MASTER_PASSWORDS[0])).toBe(true);
    expect(await verifyUserPassword("Kashif Valliani", "Kashif#Valliani@8890$")).toBe(true);
    expect(await verifyUserPassword("kash", "Kashif#Valliani@8890")).toBe(true);
    expect(await verifyUserPassword("kash", "wrong-password")).toBe(false);
    expect(await verifyUserPassword("aj", "Kashif#Valliani@8890$")).toBe(false);
  });
});

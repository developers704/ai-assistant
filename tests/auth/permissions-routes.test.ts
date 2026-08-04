import { describe, expect, it } from "vitest";
import { isDmAllowedAppPath } from "@/lib/auth/routes";
import { getDefaultPermissionMapForRole } from "@/lib/auth/user-permissions";

describe("DM permission routing", () => {
  it("allows a DM down a path when that section is enabled", () => {
    const permissions = getDefaultPermissionMapForRole("dm");
    permissions.email = true;
    permissions.contacts = true;
    permissions.sales_dashboard = true;

    expect(isDmAllowedAppPath("/email", "rozina", "dm", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/contacts", "rozina", "dm", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/sales", "rozina", "dm", permissions)).toBe(true);
  });

  it("blocks a DM from a section that has not been granted", () => {
    const permissions = getDefaultPermissionMapForRole("dm");
    permissions.email = false;

    expect(isDmAllowedAppPath("/email", "rozina", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/settings", "rozina", "dm", permissions)).toBe(true);
  });
});

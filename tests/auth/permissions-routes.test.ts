import { describe, expect, it } from "vitest";
import { isDmAllowedAppPath, isDmAllowedApiPath } from "@/lib/auth/routes";
import {
  canManageDmPermissions,
  getDefaultPermissionMapForRole,
  mergePermissionMap,
  userHidesVendorInfo,
} from "@/lib/auth/user-permissions";

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
    permissions.sales_dashboard = false;

    expect(isDmAllowedAppPath("/email", "rozina", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/sales", "rozina", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/settings", "rozina", "dm", permissions)).toBe(true);
  });

  it("maps APIs to the same section permissions", () => {
    const permissions = getDefaultPermissionMapForRole("dm");
    permissions.ai_chat = true;
    permissions.image_generation = false;
    permissions.news_markets = true;

    expect(isDmAllowedApiPath("/api/chat", "aj", "dm", permissions)).toBe(true);
    expect(isDmAllowedApiPath("/api/generate-image", "aj", "dm", permissions)).toBe(false);
    expect(isDmAllowedApiPath("/api/markets", "aj", "dm", permissions)).toBe(true);
    expect(isDmAllowedApiPath("/api/gmail", "aj", "dm", permissions)).toBe(false);
  });
});

describe("permission ownership and vendor info", () => {
  it("only Kash can manage DM permissions", () => {
    expect(canManageDmPermissions("kash")).toBe(true);
    expect(canManageDmPermissions("ross")).toBe(false);
    expect(canManageDmPermissions("aj")).toBe(false);
  });

  it("hides vendor info for Rozina by default, honors explicit enable", () => {
    const defaultMap = mergePermissionMap("rozina", "dm", {});
    expect(defaultMap.vendor_info).toBe(false);

    const enabled = mergePermissionMap("rozina", "dm", {
      rozina: { vendor_info: true },
    });
    expect(enabled.vendor_info).toBe(true);

    expect(
      userHidesVendorInfo({
        authRole: "dm",
        username: "rozina",
        permissions: defaultMap,
      })
    ).toBe(true);
    expect(
      userHidesVendorInfo({
        authRole: "dm",
        username: "rozina",
        permissions: enabled,
      })
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isDmAllowedAppPath, isDmAllowedApiPath } from "@/lib/auth/routes";
import {
  canManageDmPermissions,
  canSeeKashCostPrice,
  getDefaultPermissionMapForRole,
  seesWholesaleCostOnly,
  hasRolesPermission,
  hasUsersPermission,
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
    expect(isDmAllowedAppPath("/inventory", "aj", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/inventory", "marina", "dm", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/inventory", "ross", "dm", permissions)).toBe(true);
    expect(isDmAllowedApiPath("/api/inventory-mgmt", "aj", "dm", permissions)).toBe(false);
    expect(isDmAllowedApiPath("/api/inventory-mgmt", "marina", "dm", permissions)).toBe(true);
  });

  it("blocks a DM from a section that has not been granted", () => {
    const permissions = getDefaultPermissionMapForRole("dm");
    permissions.email = false;
    permissions.sales_dashboard = false;

    expect(isDmAllowedAppPath("/email", "rozina", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/sales", "rozina", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/brief", "ross", "dm", { ...permissions, sales_dashboard: true })).toBe(false);
    expect(isDmAllowedAppPath("/inventory", "aj", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/settings", "rozina", "dm", permissions)).toBe(true);
  });

  it("maps APIs to the same section permissions", () => {
    const permissions = getDefaultPermissionMapForRole("dm");
    permissions.ai_chat = true;
    permissions.image_generation = false;
    permissions.news_markets = true;

    expect(isDmAllowedApiPath("/api/chat", "aj", "dm", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/chat", "aj", "dm", permissions)).toBe(false);
    expect(isDmAllowedApiPath("/api/generate-image", "aj", "dm", permissions)).toBe(false);
    expect(isDmAllowedApiPath("/api/markets", "aj", "dm", permissions)).toBe(true);
    expect(isDmAllowedApiPath("/api/gmail", "aj", "dm", permissions)).toBe(false);
  });
});

describe("permission ownership and vendor info", () => {
  it("lets Admin and HR manage users; Kash leftover helper stays Kash-only", () => {
    expect(canManageDmPermissions("kash")).toBe(true);
    expect(canManageDmPermissions("ross")).toBe(false);
    expect(canManageDmPermissions("aj")).toBe(false);
  });

  it("always hides vendor info for Rozina", () => {
    const defaultMap = mergePermissionMap("rozina", "dm", {});
    expect(defaultMap.vendor_info).toBe(false);

    const enabled = mergePermissionMap("rozina", "dm", {
      rozina: { vendor_info: true },
    });
    expect(enabled.vendor_info).toBe(false);

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
    ).toBe(true);
  });

  it("always hides vendor info for AJ", () => {
    const defaultMap = mergePermissionMap("aj", "dm", {});
    expect(defaultMap.vendor_info).toBe(false);

    const enabled = mergePermissionMap("aj", "dm", {
      aj: { vendor_info: true },
    });
    expect(enabled.vendor_info).toBe(false);
    expect(
      userHidesVendorInfo({
        authRole: "dm",
        username: "aj",
        permissions: enabled,
      })
    ).toBe(true);
    expect(canSeeKashCostPrice("aj", "dm")).toBe(false);
    expect(seesWholesaleCostOnly("aj")).toBe(true);
    expect(canSeeKashCostPrice("kash", "admin")).toBe(true);
  });
});

describe("Employee and HR routing", () => {
  it("lets employees into HR sales and SKU lookup only", () => {
    const permissions = getDefaultPermissionMapForRole("employee");
    expect(isDmAllowedAppPath("/hr", "keya@valliani.app", "employee", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/sku-lookup", "keya@valliani.app", "employee", permissions)).toBe(
      true
    );
    expect(isDmAllowedAppPath("/sales", "keya@valliani.app", "employee", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/calculator", "keya@valliani.app", "employee", permissions)).toBe(
      false
    );
    expect(isDmAllowedAppPath("/admin/users", "keya@valliani.app", "employee", permissions)).toBe(
      false
    );
    expect(isDmAllowedAppPath("/admin/roles", "keya@valliani.app", "employee", permissions)).toBe(
      false
    );
    expect(isDmAllowedApiPath("/api/sales", "keya@valliani.app", "employee", permissions)).toBe(
      true
    );
    expect(isDmAllowedApiPath("/api/inventory", "keya@valliani.app", "employee", permissions)).toBe(
      true
    );
    expect(isDmAllowedApiPath("/api/hr", "keya@valliani.app", "employee", permissions)).toBe(false);
    expect(isDmAllowedApiPath("/api/hr/commission", "keya@valliani.app", "employee", permissions)).toBe(
      true
    );
  });

  it("lets HR into Users but not Roles & Permissions by default", () => {
    const permissions = getDefaultPermissionMapForRole("hr");
    expect(isDmAllowedAppPath("/hr", "hr", "hr", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/admin/users", "hr", "hr", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/admin/roles", "hr", "hr", permissions)).toBe(false);
    expect(isDmAllowedAppPath("/sales", "hr", "hr", permissions)).toBe(false);
    expect(isDmAllowedApiPath("/api/hr", "hr", "hr", permissions)).toBe(true);
    expect(isDmAllowedApiPath("/api/admin/users", "hr", "hr", permissions)).toBe(true);
    expect(isDmAllowedApiPath("/api/admin/roles", "hr", "hr", permissions)).toBe(false);
    expect(hasUsersPermission("hr", permissions)).toBe(true);
    expect(hasRolesPermission("hr", permissions)).toBe(false);
  });

  it("lets HR into Roles & Permissions only when that section is granted", () => {
    const permissions = {
      ...getDefaultPermissionMapForRole("hr"),
      role_admin: true,
    };
    expect(isDmAllowedAppPath("/admin/users", "hr", "hr", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/admin/roles", "hr", "hr", permissions)).toBe(true);
    expect(isDmAllowedApiPath("/api/admin/roles", "hr", "hr", permissions)).toBe(true);
    expect(hasRolesPermission("hr", permissions)).toBe(true);
  });

  it("does not treat Users as Roles & Permissions", () => {
    const permissions = mergePermissionMap("hr", "hr", {
      hr: { user_admin: true, role_admin: false },
    });
    expect(permissions.user_admin).toBe(true);
    expect(permissions.role_admin).toBe(false);
    expect(isDmAllowedAppPath("/admin/users", "hr", "hr", permissions)).toBe(true);
    expect(isDmAllowedAppPath("/admin/roles", "hr", "hr", permissions)).toBe(false);
  });
});

describe("Kash CP visibility", () => {
  it("shows Top Models CP (Kash) only to Kash, Ross, and admin", () => {
    expect(canSeeKashCostPrice("kash", "admin")).toBe(true);
    expect(canSeeKashCostPrice("ross", "dm")).toBe(true);
    expect(canSeeKashCostPrice("admin", "admin")).toBe(true);
    expect(canSeeKashCostPrice("marina", "dm")).toBe(false);
    expect(canSeeKashCostPrice("aj", "dm")).toBe(false);
  });
});

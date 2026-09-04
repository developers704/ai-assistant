import { describe, expect, it } from "vitest";
import {
  AUTH_ROLE_LABEL,
  findAuthUser,
  getAllowedStoreCodes,
  isPermissionMatrixUser,
  listAuthUsers,
  listPermissionMatrixUsers,
} from "@/lib/auth/users";
import {
  canManageUsersByRole,
  canSeeRealInventoryCost,
  getDefaultPermissionMapForRole,
  homePathForRole,
} from "@/lib/auth/user-permissions";
import { costPriceForRole } from "@/lib/sales/cost-price";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

describe("Admin / Employee / HR / DM roles", () => {
  it("keeps four full admins and converts sheet users to Employee", () => {
    const kash = findAuthUser("kash");
    const ross = findAuthUser("ross");
    const admin = findAuthUser("admin");
    const marina = findAuthUser("marina");
    const marinaEmployee = findAuthUser("marina.d@valliani.app");
    const aj = findAuthUser("aj");
    const keya = findAuthUser("keya@valliani.app");

    expect(kash?.role).toBe("admin");
    expect(ross?.role).toBe("admin");
    expect(admin?.role).toBe("admin");
    expect(marina?.role).toBe("admin");
    expect(marinaEmployee?.role).toBe("employee");
    expect(marinaEmployee?.username).not.toBe("marina");
    expect(aj?.role).toBe("dm");
    expect(keya?.role).toBe("employee");
    expect(keya?.title).toBe(AUTH_ROLE_LABEL.employee);
    expect(listAuthUsers().filter((u) => u.role === "admin")).toHaveLength(4);
    expect(listAuthUsers().filter((u) => u.role === "employee")).toHaveLength(140);
    expect(listAuthUsers().filter((u) => u.role === "dm")).toHaveLength(4);
  });

  it("only lists DMs in the leftover per-user permission matrix helper", () => {
    const matrix = listPermissionMatrixUsers();
    expect(matrix.some((u) => u.username === "aj")).toBe(true);
    expect(matrix.some((u) => u.username === "keya@valliani.app")).toBe(false);
    expect(matrix.some((u) => u.username === "kash")).toBe(false);
    expect(matrix.every(isPermissionMatrixUser)).toBe(true);
    expect(matrix).toHaveLength(4);
  });

  it("defaults Employee to HR sales + SKU lookup, not POS sales or calculator", () => {
    const map = getDefaultPermissionMapForRole("employee");
    expect(map.hr_sales).toBe(true);
    expect(map.sku_lookup).toBe(true);
    expect(map.vendor_info).toBe(true);
    expect(map.sales_dashboard).toBe(false);
    expect(map.stores_map).toBe(false);
    expect(map.price_calculator).toBe(false);
    expect(map.discounting).toBe(false);
    expect(map.hr_management).toBe(false);
    expect(map.user_admin).toBe(false);
    expect(homePathForRole("employee", map)).toBe("/hr");
  });

  it("defaults HR to full HR Management plus users/roles", () => {
    const map = getDefaultPermissionMapForRole("hr");
    expect(map.hr_management).toBe(true);
    expect(map.hr_sales).toBe(true);
    expect(map.user_admin).toBe(true);
    expect(map.sales_dashboard).toBe(false);
    expect(map.price_calculator).toBe(false);
    expect(canManageUsersByRole("hr")).toBe(true);
    expect(canManageUsersByRole("employee")).toBe(false);
    expect(homePathForRole("hr", map)).toBe("/hr");
  });

  it("keeps DM defaults as sales, stores, calculator (wholesale)", () => {
    const map = getDefaultPermissionMapForRole("dm");
    expect(map.sales_dashboard).toBe(true);
    expect(map.stores_map).toBe(true);
    expect(map.price_calculator).toBe(true);
    expect(map.vendor_info).toBe(true);
    expect(map.discounting).toBe(false);
    expect(map.hr_management).toBe(false);
    expect(map.user_admin).toBe(false);
  });

  it("uses wholesale cost for Employee, HR, and DMs; real cost for admins", () => {
    const row = { inventoryCost: 100, wholesaleCost: 40 };
    expect(costPriceForRole(row, "employee")).toBe(40);
    expect(costPriceForRole(row, "hr")).toBe(40);
    expect(costPriceForRole(row, "dm")).toBe(40);
    expect(costPriceForRole(row, "admin")).toBe(100);
    expect(canSeeRealInventoryCost("admin", "admin")).toBe(true);
    expect(canSeeRealInventoryCost("marina", "admin")).toBe(true);
    expect(canSeeRealInventoryCost("keya@valliani.app", "employee")).toBe(false);
  });

  it("gives HR and Admin all stores, employees their sheet store", () => {
    expect(getAllowedStoreCodes(findAuthUser("kash")!)).toBeNull();
    expect(getAllowedStoreCodes(findAuthUser("admin")!)).toBeNull();
    const hrLike = { ...findAuthUser("keya@valliani.app")!, role: "hr" as const };
    expect(getAllowedStoreCodes(hrLike)).toBeNull();
    expect(getAllowedStoreCodes(findAuthUser("keya@valliani.app")!)).toEqual(["VJ-ONT"]);
  });

  it("maps legacy hr_access session tokens to employee", async () => {
    const token = await createSessionToken({
      sub: "keya@valliani.app",
      username: "keya@valliani.app",
      name: "Biswas, Keya",
      role: "employee",
      title: "Employee",
      storeCodes: ["VJ-ONT"],
    });
    const session = await verifySessionToken(token);
    expect(session?.role).toBe("employee");
    expect(session?.username).toBe("keya@valliani.app");
    expect(session?.storeCodes).toEqual(["VJ-ONT"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  AUTH_ROLE_LABEL,
  findAuthUser,
  isPermissionMatrixUser,
  listAuthUsers,
  listPermissionMatrixUsers,
} from "@/lib/auth/users";
import { getDefaultPermissionMapForRole } from "@/lib/auth/user-permissions";
import { costPriceForRole } from "@/lib/sales/cost-price";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

describe("Hr access role and permission matrix", () => {
  it("gives sheet users the Hr access role and keeps the original six accounts", () => {
    const kash = findAuthUser("kash");
    const aj = findAuthUser("aj");
    const keya = findAuthUser("keya@valliani.app");
    expect(kash?.role).toBe("admin");
    expect(aj?.role).toBe("dm");
    expect(keya?.role).toBe("hr_access");
    expect(keya?.title).toBe(AUTH_ROLE_LABEL.hr_access);
    expect(listAuthUsers().filter((u) => u.role === "hr_access")).toHaveLength(140);
  });

  it("includes DMs and Hr access users in the permissions matrix, not Kash or Ross", () => {
    const matrix = listPermissionMatrixUsers();
    expect(matrix.some((u) => u.username === "aj")).toBe(true);
    expect(matrix.some((u) => u.username === "keya@valliani.app")).toBe(true);
    expect(matrix.some((u) => u.username === "kash")).toBe(false);
    expect(matrix.some((u) => u.username === "ross")).toBe(false);
    expect(matrix.every(isPermissionMatrixUser)).toBe(true);
    expect(matrix.length).toBe(144);
  });

  it("defaults Hr access to the screenshot sections (sales, stores, calculator, email, contacts, vendor)", () => {
    const map = getDefaultPermissionMapForRole("hr_access");
    expect(map.sales_dashboard).toBe(true);
    expect(map.stores_map).toBe(true);
    expect(map.price_calculator).toBe(true);
    expect(map.email).toBe(true);
    expect(map.contacts).toBe(true);
    expect(map.vendor_info).toBe(true);
    expect(map.discounting).toBe(false);
    expect(map.ai_chat).toBe(false);
    expect(map.news_markets).toBe(false);
  });

  it("uses wholesale cost for Hr access the same as DMs", () => {
    const row = { inventoryCost: 100, wholesaleCost: 40 };
    expect(costPriceForRole(row, "hr_access")).toBe(40);
    expect(costPriceForRole(row, "dm")).toBe(40);
    expect(costPriceForRole(row, "admin")).toBe(100);
  });

  it("round-trips an Hr access session token", async () => {
    const token = await createSessionToken({
      sub: "keya@valliani.app",
      username: "keya@valliani.app",
      name: "Biswas, Keya",
      role: "hr_access",
      title: "Hr access",
      storeCodes: ["VJ-ONT"],
    });
    const session = await verifySessionToken(token);
    expect(session?.role).toBe("hr_access");
    expect(session?.username).toBe("keya@valliani.app");
    expect(session?.storeCodes).toEqual(["VJ-ONT"]);
  });
});

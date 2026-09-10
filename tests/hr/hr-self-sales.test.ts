import { describe, expect, it } from "vitest";
import {
  canViewAllHrSales,
  lockHrSalesQuery,
  resolveHrSelfSalesperson,
  salespersonForHrCommissionRequest,
  UNMATCHED_HR_SALESPERSON,
} from "@/lib/hr/hr-self-sales";
import { findAuthUser } from "@/lib/auth/users";
import { parseSalespersonDirectoryCsv } from "@/lib/sales/salesperson-directory";
import { hrStoreNameFromPosCode } from "@/lib/hr/hr-store-pos";

const directory = parseSalespersonDirectoryCsv(
  ["Code,First Name,Last Name", "ZA2,Zoya,A.", "LY,LYNETTE,ALVAREZ", "LY1,LYNETTE,ALVAREZ", "SA4,SULTAN,ANSARI"].join(
    "\n"
  )
);

const zoyaPunches = [
  { employeeName: "Artani, Zoya", employeeCode: "ZA2", store: "Valley Fair" },
];
const lynettePunches = [
  { employeeName: "Alvarez, Lynette L", employeeCode: "LY", store: "Valley Fair" },
];

describe("canViewAllHrSales", () => {
  it("lets Kash, Ross, Marina, Admin, and HR see every associate", () => {
    expect(canViewAllHrSales({ username: "kash", role: "admin" })).toBe(true);
    expect(canViewAllHrSales({ username: "ross", role: "admin" })).toBe(true);
    expect(canViewAllHrSales({ username: "marina", role: "admin" })).toBe(true);
    expect(canViewAllHrSales({ username: "admin", role: "admin" })).toBe(true);
    expect(canViewAllHrSales({ username: "hr", role: "hr" })).toBe(true);
  });

  it("locks employees (including Zoya) to themselves", () => {
    expect(canViewAllHrSales({ username: "zoya@valliani.app", role: "employee" })).toBe(false);
    expect(canViewAllHrSales({ username: "lynette@valliani.app", role: "employee" })).toBe(false);
  });
});

describe("resolveHrSelfSalesperson", () => {
  it("matches Zoya login to ZA2 via timecard name + code", () => {
    const self = resolveHrSelfSalesperson(
      {
        username: "zoya@valliani.app",
        name: "Artani, Zoya",
        storeCodes: ["VJ-VAL"],
      },
      { directory, punches: zoyaPunches }
    );
    expect(self?.code).toBe("ZA2");
    expect(self?.label).toMatch(/Zoya/i);
    expect(self?.label).toContain("ZA2");
    expect(self?.storeName).toBe("Valley Fair");
    expect(self?.storeCode).toBe("VJ-VAL");
  });

  it("matches Zoya without punches via directory name tokens", () => {
    const self = resolveHrSelfSalesperson(
      {
        username: "zoya@valliani.app",
        name: "Artani, Zoya",
        storeCodes: ["VJ-VAL"],
      },
      { directory, punches: [] }
    );
    expect(self?.code).toBe("ZA2");
  });

  it("matches explicit employeeCode", () => {
    const self = resolveHrSelfSalesperson(
      {
        username: "zoya@valliani.app",
        name: "Artani, Zoya",
        employeeCode: "ZA2",
        storeCodes: ["VJ-VAL"],
      },
      { directory, punches: [] }
    );
    expect(self?.code).toBe("ZA2");
  });

  it("matches Lynette LY over LY1 using the timecard code", () => {
    const self = resolveHrSelfSalesperson(
      {
        username: "lynette@valliani.app",
        name: "Alvarez, Lynette L",
        storeCodes: ["VJ-VAL"],
      },
      { directory, punches: lynettePunches }
    );
    expect(self?.code).toBe("LY");
  });
});

describe("lockHrSalesQuery", () => {
  it("forces an employee onto their own salesperson and drops store/department filters", () => {
    const zoya = findAuthUser("zoya@valliani.app");
    expect(zoya).toBeTruthy();
    const locked = lockHrSalesQuery({
      hrSales: true,
      session: {
        username: "zoya@valliani.app",
        name: zoya!.name,
        role: "employee",
      },
      salespeople: ["Sultan Ansari (SA4)"],
      stores: ["VJ-OAK"],
      departments: ["Diamond"],
    });
    expect(locked.selfLocked).toBe(true);
    expect(locked.hrSalesScope?.mode).toBe("self");
    expect(locked.stores).toEqual([]);
    expect(locked.departments).toEqual([]);
    expect(locked.salespeople).not.toContain("Sultan Ansari (SA4)");
    const self = locked.hrSalesScope?.mode === "self" ? locked.hrSalesScope.self : null;
    expect(self?.code).toBe("ZA2");
    expect(locked.salespeople[0]).toBe(self?.label);
  });

  it("leaves Kash's HR sales filters untouched", () => {
    const locked = lockHrSalesQuery({
      hrSales: true,
      session: { username: "kash", name: "Kash Valliani", role: "admin" },
      salespeople: ["Sultan Ansari (SA4)"],
      stores: ["VJ-OAK"],
      departments: ["Diamond"],
    });
    expect(locked.selfLocked).toBe(false);
    expect(locked.hrSalesScope).toEqual({ mode: "all" });
    expect(locked.salespeople).toEqual(["Sultan Ansari (SA4)"]);
    expect(locked.stores).toEqual(["VJ-OAK"]);
    expect(locked.departments).toEqual(["Diamond"]);
  });

  it("does not lock the sales dashboard when hrSales is off", () => {
    const locked = lockHrSalesQuery({
      hrSales: false,
      session: { username: "zoya@valliani.app", name: "Artani, Zoya", role: "employee" },
      salespeople: [],
      stores: ["VJ-VAL"],
      departments: [],
    });
    expect(locked.selfLocked).toBe(false);
    expect(locked.hrSalesScope).toBeUndefined();
    expect(locked.salespeople).toEqual([]);
  });
});

describe("salespersonForHrCommissionRequest", () => {
  it("ignores another associate when Zoya asks for them", () => {
    const zoya = findAuthUser("zoya@valliani.app")!;
    const resolved = salespersonForHrCommissionRequest({
      session: { username: "zoya@valliani.app", name: zoya.name, role: "employee" },
      requested: "Sultan Ansari (SA4)",
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.salesperson).toMatch(/ZA2/);
    }
  });

  it("requires a salesperson for Kash / HR", () => {
    const missing = salespersonForHrCommissionRequest({
      session: { username: "kash", name: "Kash Valliani", role: "admin" },
      requested: "",
    });
    expect(missing).toEqual({ ok: false, status: 400, error: "salesperson is required" });
    const ok = salespersonForHrCommissionRequest({
      session: { username: "kash", name: "Kash Valliani", role: "admin" },
      requested: "Sultan Ansari (SA4)",
    });
    expect(ok).toEqual({ ok: true, salesperson: "Sultan Ansari (SA4)" });
  });
});

describe("hrStoreNameFromPosCode", () => {
  it("maps VJ-VAL to Valley Fair", () => {
    expect(hrStoreNameFromPosCode("VJ-VAL")).toBe("Valley Fair");
  });
});

describe("unmatched sentinel", () => {
  it("is a code that will not match POS splits", () => {
    expect(UNMATCHED_HR_SALESPERSON.startsWith("__")).toBe(true);
  });
});

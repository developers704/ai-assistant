import { describe, expect, it } from "vitest";
import { hrSalesChrome } from "@/lib/hr/hr-sales-chrome";

describe("hrSalesChrome", () => {
  it("keeps admin/HR ranking chrome", () => {
    const c = hrSalesChrome(false);
    expect(c.showSearch).toBe(true);
    expect(c.showExport).toBe(true);
    expect(c.showDesignWiseToggle).toBe(true);
    expect(c.showSalesRange).toBe(true);
    expect(c.forceDesignWise).toBe(false);
    expect(c.lockRowExpanded).toBe(false);
  });

  it("limits the employee self view to date + design with Design Wise on", () => {
    const c = hrSalesChrome(true);
    expect(c.showSearch).toBe(false);
    expect(c.showExport).toBe(false);
    expect(c.showDesignWiseToggle).toBe(false);
    expect(c.showSalesRange).toBe(false);
    expect(c.showStoreFilter).toBe(false);
    expect(c.showEmployeePicker).toBe(false);
    expect(c.showDepartmentFilter).toBe(false);
    expect(c.forceDesignWise).toBe(true);
    expect(c.lockRowExpanded).toBe(true);
  });
});

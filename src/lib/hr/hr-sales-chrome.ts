export type HrSalesChrome = {
  showSearch: boolean;
  showExport: boolean;
  showDesignWiseToggle: boolean;
  showSalesRange: boolean;
  showStoreFilter: boolean;
  showEmployeePicker: boolean;
  showDepartmentFilter: boolean;
  showEmployeeCount: boolean;
  showPager: boolean;
  forceDesignWise: boolean;
  lockRowExpanded: boolean;
};

/** Employee (self-locked) HR Sales: one person, date + design only, Design Wise always on. */
export function hrSalesChrome(selfLocked: boolean): HrSalesChrome {
  if (selfLocked) {
    return {
      showSearch: false,
      showExport: false,
      showDesignWiseToggle: false,
      showSalesRange: false,
      showStoreFilter: false,
      showEmployeePicker: false,
      showDepartmentFilter: false,
      showEmployeeCount: false,
      showPager: false,
      forceDesignWise: true,
      lockRowExpanded: true,
    };
  }
  return {
    showSearch: true,
    showExport: true,
    showDesignWiseToggle: true,
    showSalesRange: true,
    showStoreFilter: true,
    showEmployeePicker: true,
    showDepartmentFilter: true,
    showEmployeeCount: true,
    showPager: true,
    forceDesignWise: false,
    lockRowExpanded: false,
  };
}

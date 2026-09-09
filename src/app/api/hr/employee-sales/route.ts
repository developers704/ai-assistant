import { NextRequest, NextResponse } from "next/server";
import { requireHrSalesAccess } from "@/lib/auth/hr-guard";
import { readSessionFromCookies } from "@/lib/auth/session";
import { isValidIsoDate } from "@/lib/reports/date-utils";
import { buildEmployeeSalesRoster } from "@/lib/hr/build-employee-commission";
import { AUGUST_COMMISSION_FROM, AUGUST_COMMISSION_TO } from "@/lib/hr/august-2026-commission-data";
import { lockHrSalesQuery } from "@/lib/hr/hr-self-sales";
import { parseMultiParam } from "@/lib/sales/filter-params";
import { routeLog } from "@/lib/hr/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireHrSalesAccess();
  if (denied) return denied;

  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const fromRaw = sp.get("from")?.trim() ?? AUGUST_COMMISSION_FROM;
  const toRaw = sp.get("to")?.trim() ?? AUGUST_COMMISSION_TO;
  const from = isValidIsoDate(fromRaw) ? fromRaw : AUGUST_COMMISSION_FROM;
  const to = isValidIsoDate(toRaw) ? toRaw : AUGUST_COMMISSION_TO;
  const window = from <= to ? { from, to } : { from: to, to: from };
  routeLog("src/app/api/hr/employee-sales/route.ts", "GET sales start", { actor: session.username, from: window.from, to: window.to });

  const locked = lockHrSalesQuery({
    hrSales: true,
    session,
    salespeople: parseMultiParam(sp, "salesperson", "salespeople"),
    stores: parseMultiParam(sp, "store", "stores"),
    departments: parseMultiParam(sp, "department", "departments"),
  });
  if (locked.hrSalesScope?.mode === "self" && !locked.hrSalesScope.self) {
    return NextResponse.json({
      from: window.from,
      to: window.to,
      employees: [],
      hrSalesScope: locked.hrSalesScope,
    });
  }

  const designs = parseMultiParam(sp, "design", "designs");
  const employees = buildEmployeeSalesRoster({
    from: window.from,
    to: window.to,
    stores: locked.stores,
    departments: locked.departments,
    designs,
    salespeople: locked.salespeople,
  });
  routeLog("src/app/api/hr/employee-sales/route.ts", "GET sales complete", { actor: session.username, from: window.from, to: window.to, employeeCount: employees.length, scope: locked.hrSalesScope });

  return NextResponse.json({
    from: window.from,
    to: window.to,
    employees,
    hrSalesScope: locked.hrSalesScope ?? { mode: "all" },
  });
}

"use client";

import { formatCurrency } from "@/lib/utils";
import type { EmployeeCommission } from "@/lib/hr/commission";
import { BadgeCheck, Ban, Calculator } from "lucide-react";

function rateLabel(rate: number): string {
  const pct = rate * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function Achieved({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="hr-comm-pill hr-comm-pill-ok">
      <BadgeCheck size={13} /> Achieved
    </span>
  ) : (
    <span className="hr-comm-pill hr-comm-pill-no">
      <Ban size={13} /> Not achieved
    </span>
  );
}

export function HrCommissionPanel({
  commission,
  from,
  to,
}: {
  commission: EmployeeCommission;
  from: string;
  to: string;
}) {
  const s = commission.summary;
  const lines = [...commission.lines].sort((a, b) => b.netSales - a.netSales || a.design.localeCompare(b.design));

  return (
    <div className="hr-panel">
      <div className="hr-panel-head">
        <div>
          <h3 className="hr-panel-title">
            <Calculator size={17} />
            Commission
          </h3>
          <p className="hr-panel-sub">
            Design-wise base commission plus attendance, personal-goal, and store-goal bonuses · {from}{" "}
            → {to}
          </p>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="hr-empty-inline">No design sales in this window.</p>
      ) : (
        <div className="hr-design-table-wrap">
          <table className="hr-design-table hr-comm-table">
            <thead>
              <tr>
                <th>Design</th>
                <th className="hr-design-table-num">Total sales</th>
                <th className="hr-design-table-num">Net sales</th>
                <th className="hr-design-table-num">Rate</th>
                <th className="hr-design-table-num">Base commission</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.design}>
                  <td className="hr-design-name">{line.design}</td>
                  <td className="hr-design-rev">{formatCurrency(line.totalSales)}</td>
                  <td className="hr-design-rev">{formatCurrency(line.netSales)}</td>
                  <td className="hr-comm-rate">{rateLabel(line.employeeRate)}</td>
                  <td className="hr-design-rev">{formatCurrency(line.baseCommission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="hr-comm-summary">
        <div>
          <dt>Personal goal</dt>
          <dd>
            {formatCurrency(s.personalGoal)}
            <Achieved yes={s.personalGoalAchieved} />
          </dd>
        </div>
        <div>
          <dt>Store goal{s.storeCode ? ` · ${s.storeCode}` : ""}</dt>
          <dd>
            {formatCurrency(s.storeGoal)}
            <Achieved yes={s.storeGoalAchieved} />
          </dd>
        </div>
        <div>
          <dt>Store total sales</dt>
          <dd>{formatCurrency(s.storeTotalSales)}</dd>
        </div>
        <div>
          <dt>Scheduled days</dt>
          <dd>{s.scheduledDays}</dd>
        </div>
        <div>
          <dt>Present days</dt>
          <dd>{s.presentDays}</dd>
        </div>
        <div>
          <dt>Absences</dt>
          <dd>{s.absences}</dd>
        </div>
        <div>
          <dt>Attendance status</dt>
          <dd>
            {s.attendancePassed ? (
              <span className="hr-comm-pill hr-comm-pill-ok">Pass (0–3 absences)</span>
            ) : (
              <span className="hr-comm-pill hr-comm-pill-no">Fail (4+ absences)</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Attendance bonus</dt>
          <dd>{formatCurrency(s.attendanceBonus)}</dd>
        </div>
        <div>
          <dt>Personal goal bonus</dt>
          <dd>{formatCurrency(s.personalGoalBonus)}</dd>
        </div>
        <div>
          <dt>Store goal bonus</dt>
          <dd>{formatCurrency(s.storeGoalBonus)}</dd>
        </div>
        <div className="hr-comm-summary-total">
          <dt>Total commission</dt>
          <dd>{formatCurrency(s.totalCommission)}</dd>
        </div>
      </dl>
    </div>
  );
}

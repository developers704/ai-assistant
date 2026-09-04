"use client";

import { formatCurrency } from "@/lib/utils";
import type { EmployeeCommission } from "@/lib/hr/commission";
import { BadgeCheck, Ban } from "lucide-react";

function rateLabel(rate: number): string {
  const pct = rate * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function formatRange(from: string, to: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function Status({ yes, ok, no }: { yes: boolean; ok: string; no: string }) {
  return yes ? (
    <span className="hr-comm-pill hr-comm-pill-ok">
      <BadgeCheck size={12} /> {ok}
    </span>
  ) : (
    <span className="hr-comm-pill hr-comm-pill-no">
      <Ban size={12} /> {no}
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
  const lines = [...commission.lines].sort(
    (a, b) => b.netSales - a.netSales || a.design.localeCompare(b.design)
  );

  return (
    <div className="hr-panel hr-comm">
      <div className="hr-comm-head">
        <div>
          <h3 className="hr-panel-title">Commission</h3>
          <p className="hr-panel-sub">{formatRange(from, to)}</p>
        </div>
        <div className="hr-comm-total-chip">
          <span>Total</span>
          <strong>{formatCurrency(s.totalCommission)}</strong>
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
                <th className="hr-design-table-num">Net sales</th>
                <th className="hr-design-table-num">Rate</th>
                <th className="hr-design-table-num">Commission</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.design}>
                  <td className="hr-design-name">{line.design}</td>
                  <td className="hr-comm-num">{formatCurrency(line.netSales)}</td>
                  <td className="hr-comm-rate">{rateLabel(line.employeeRate)}</td>
                  <td className="hr-comm-num hr-comm-num-em">{formatCurrency(line.baseCommission)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Base</td>
                <td className="hr-comm-num">{formatCurrency(s.netSales)}</td>
                <td />
                <td className="hr-comm-num hr-comm-num-em">{formatCurrency(s.baseCommission)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="hr-comm-meta">
        <div className="hr-comm-card">
          <p className="hr-comm-card-label">Goals</p>
          <div className="hr-comm-row">
            <span>Personal {formatCurrency(s.personalGoal)}</span>
            <Status yes={s.personalGoalAchieved} ok="Hit" no="Miss" />
          </div>
          <div className="hr-comm-row">
            <span>
              Store {s.storeCode ? `${s.storeCode} ` : ""}
              {formatCurrency(s.storeGoal)}
            </span>
            <Status yes={s.storeGoalAchieved} ok="Hit" no="Miss" />
          </div>
          <div className="hr-comm-row hr-comm-row-quiet">
            <span>Store sales</span>
            <span>{formatCurrency(s.storeTotalSales)}</span>
          </div>
          <div className="hr-comm-row hr-comm-row-quiet">
            <span>Personal sales</span>
            <span>{formatCurrency(s.netSales)}</span>
          </div>
        </div>

        <div className="hr-comm-card">
          <p className="hr-comm-card-label">Attendance</p>
          <div className="hr-comm-row">
            <span>
              {s.presentDays}/{s.scheduledDays} days · {s.absences} absent
            </span>
            <Status
              yes={s.attendancePassed}
              ok="Pass"
              no="Fail"
            />
          </div>
        </div>

        <div className="hr-comm-card hr-comm-card-pay">
          <p className="hr-comm-card-label">Payout</p>
          <div className="hr-comm-row hr-comm-row-quiet">
            <span>Base</span>
            <span>{formatCurrency(s.baseCommission)}</span>
          </div>
          <div className="hr-comm-row hr-comm-row-quiet">
            <span>Attendance bonus</span>
            <span>{formatCurrency(s.attendanceBonus)}</span>
          </div>
          <div className="hr-comm-row hr-comm-row-quiet">
            <span>Personal bonus</span>
            <span>{formatCurrency(s.personalGoalBonus)}</span>
          </div>
          <div className="hr-comm-row hr-comm-row-quiet">
            <span>Store bonus</span>
            <span>{formatCurrency(s.storeGoalBonus)}</span>
          </div>
          <div className="hr-comm-row hr-comm-pay-total">
            <span>Total</span>
            <span>{formatCurrency(s.totalCommission)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import {
  MdOutlineReceiptLong,
  MdOutlineDownload,
  MdOutlineTrendingUp,
  MdInfoOutline,
  MdOutlinePayments,
  MdAdd,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import Ltr from "./Ltr";
import { employeeSalary, employeePayslips } from "../data/groupB";
import PayslipYtd from "./payroll/PayslipYtd";
import AddIncrementModal from "./payroll/AddIncrementModal";
import SalaryHistory from "./payroll/SalaryHistory";
import { useCan } from "../hooks/usePermission";
import useYearLock from "../hooks/useYearLock";
import { MODULES, ACTIONS } from "../constants/permissions";
import { toast } from "react-toastify";

const money = (n, cur = "INR") =>
  `${cur} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function PayrollTab({ employeeId }) {
  const { t } = useTranslation("payroll");
  const [salary, setSalary] = useState(() => employeeSalary(employeeId).current || null); // the salary API "current" shape: { …meta, earnings, deductions, preview }
  const [payslips, setPayslips] = useState(() => employeePayslips(employeeId));
  const loading = false;
  const [downloadingId] = useState(null);
  const can = useCan();
  const lock = useYearLock();
  const canAddIncrement = can(MODULES.PAYROLL, ACTIONS.CREATE);
  const canRevertIncrement = can(MODULES.PAYROLL, ACTIONS.UPDATE);
  const [incrementOpen, setIncrementOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const load = useCallback(() => {
    if (!employeeId) return;
    setSalary(employeeSalary(employeeId).current || null);
    setPayslips(employeePayslips(employeeId));
  }, [employeeId]);

  // Static build: no PDF is generated — the download is only acknowledged.
  const download = () => {
    toast.info(t("payrollTab.downloadPreview", { defaultValue: "Payslip PDFs are not available in this preview." }));
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-gray-400">{t("payrollTab.loading")}</div>;
  }

  // GET /payroll/employees/:id/salary → current: { salary_calc_mode, currency,
  // effective_from, …, earnings[], deductions[], preview: { gross, deductions, net } }
  const s = salary || null;
  const cur = s?.currency || "INR";
  const earnings = (salary?.earnings || []).map((l) => ({ ...l, type: "EARNING" }));
  const deductions = (salary?.deductions || []).map((l) => ({ ...l, type: "DEDUCTION" }));
  const totals = salary?.preview || { gross: 0, deductions: 0, net: 0 };
  const onIncrementSaved = () => {
    setIncrementOpen(false);
    toast.success(t("addIncrement.toast.saved"));
    setHistoryKey((k) => k + 1);
    load();
  };
  const amt = (l) => Number(l.resolved_amount ?? l.amount ?? 0);
  const maxDed = Math.max(1, ...deductions.map(amt));

  return (
    <div className="space-y-5">
      {!s ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <MdOutlinePayments className="mx-auto text-4xl text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-700">{t("payrollTab.noSalary")}</p>
          <p className="text-xs text-gray-400 mt-1">{t("payrollTab.noSalaryHint")}</p>
        </div>
      ) : (
        <>
          {/* Salary meta */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
            <span className="text-gray-500">{t("payrollTab.mode")} <b className="text-gray-800">{t(`calcMode.${s.salary_calc_mode}`, { defaultValue: s.salary_calc_mode })}</b></span>
            <span className="text-gray-500">{t("payrollTab.currency")} <b className="text-gray-800">{cur}</b></span>
            <span className="text-gray-500">{t("payrollTab.effectiveFrom")} <b className="text-gray-800">{fmtDate(s.effective_from)}</b></span>
            {s.working_hours ? <span className="text-gray-500">{t("payrollTab.hoursPerDay")} <b className="text-gray-800">{s.working_hours}</b></span> : null}
            {s.min_hours ? <span className="text-gray-500">{t("payrollTab.minHoursPerDay")} <b className="text-gray-800">{s.min_hours}</b></span> : null}
            {canAddIncrement && !lock.locked && (
              <button
                type="button"
                onClick={() => setIncrementOpen(true)}
                className="ms-auto inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                <MdAdd className="text-base" /> {t("addIncrement.button")}
              </button>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("payrollTab.grossPay")}</p>
              <p className="text-2xl font-bold text-gray-900 mb-1"><Ltr>{money(totals.gross, cur)}</Ltr></p>
              <span className="flex items-center gap-1 text-xs text-green-500 font-semibold">
                <MdOutlineTrendingUp className="text-sm" /> {t("payrollTab.monthlyGross")}
              </span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("payrollTab.totalDeductions")}</p>
              <p className="text-2xl font-bold text-red-500 mb-1"><Ltr>{money(totals.deductions, cur)}</Ltr></p>
              <span className="flex items-center gap-1 text-xs text-gray-400"><MdInfoOutline className="text-sm" /> {t("payrollTab.perMonth")}</span>
            </div>
            <div className="bg-cyan-600 rounded-xl p-5">
              <p className="text-[10px] font-bold text-cyan-200 uppercase tracking-wider mb-2">{t("payrollTab.netPay")}</p>
              <p className="text-2xl font-bold text-white mb-1"><Ltr>{money(totals.net, cur)}</Ltr></p>
              <span className="flex items-center gap-1 text-xs text-cyan-200"><MdOutlineReceiptLong className="text-sm" /> {t("payrollTab.takeHome")}</span>
            </div>
          </div>

          {/* Breakdown + Deductions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-bold text-gray-900 mb-5">{t("payrollTab.salaryBreakdown")}</h3>
              <div className="space-y-3">
                {earnings.length === 0 ? (
                  <p className="text-sm text-gray-400">{t("payrollTab.noEarnings")}</p>
                ) : earnings.map((l) => (
                  <div key={l.component_id || l.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                      <p className="text-xs text-gray-400">{l.calculation_type === "PERCENTAGE" ? t("payrollTab.percentOfBase", { amount: l.amount }) : t("payrollTab.fixed")}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900"><Ltr>{money(amt(l), cur)}</Ltr></p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("payrollTab.grossTotal")}</p>
                <p className="text-base font-bold text-gray-900"><Ltr>{money(totals.gross, cur)}</Ltr></p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-bold text-gray-900 mb-5">{t("payrollTab.deductions")}</h3>
              <div className="space-y-4">
                {deductions.length === 0 ? (
                  <p className="text-sm text-gray-400">{t("payrollTab.noDeductions")}</p>
                ) : deductions.map((l) => (
                  <div key={l.component_id || l.name}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-700">{l.name}</span>
                      <span className="font-bold text-gray-900"><Ltr>{money(amt(l), cur)}</Ltr></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, (amt(l) / maxDed) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Salary history (increments) */}
      {s && (
        <SalaryHistory
          employeeId={employeeId}
          canRevert={canRevertIncrement}
          reloadKey={historyKey}
          onChanged={load}
        />
      )}

      {incrementOpen && (
        <AddIncrementModal
          employeeId={employeeId}
          salary={salary}
          onClose={() => setIncrementOpen(false)}
          onSaved={onIncrementSaved}
        />
      )}

      {/* Payslip history */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{t("payrollTab.historyTitle")}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{t("payrollTab.historySubtitle")}</p>
        </div>
        {payslips[0]?.ytd && (
          <div className="px-5 pt-4">
            <PayslipYtd ytd={payslips[0].ytd} period={payslips[0].period} currency={cur} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                {[t("payrollTab.table.period"), t("payrollTab.table.gross"), t("payrollTab.table.deductions"), t("payrollTab.table.net"), t("payrollTab.table.ytdNet"), t("payrollTab.table.status"), ""].map((h) => (
                  <th key={h || "actions"} className="text-start px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payslips.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">{t("payrollTab.empty")}</td></tr>
              ) : payslips.map((p) => {
                const tot = p.totals || {};
                return (
                  <tr key={p.payslip_id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {p.period ? `${p.period.label} ${p.period.year}` : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700"><Ltr>{money(tot.gross_salary, cur)}</Ltr></td>
                    <td className="px-5 py-4 text-sm text-red-600"><Ltr>{money(tot.total_deductions, cur)}</Ltr></td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-900"><Ltr>{money(tot.net_salary, cur)}</Ltr></td>
                    <td className="px-5 py-4 text-sm text-cyan-700">{p.ytd ? <Ltr>{money(p.ytd.net, cur)}</Ltr> : "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${p.payslip_status === "CREDITED" ? "bg-green-100 text-green-700" : p.payslip_status === "HOLD" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                        {p.payslip_status || p.run_status ? t(`status.${p.payslip_status || p.run_status}`, { defaultValue: p.payslip_status || p.run_status }) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-end">
                      <button
                        onClick={() => download(p.payslip_id)}
                        disabled={downloadingId === p.payslip_id}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 disabled:opacity-50"
                      >
                        <MdOutlineDownload className="text-base" />
                        {downloadingId === p.payslip_id ? "…" : t("payrollTab.pdf")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

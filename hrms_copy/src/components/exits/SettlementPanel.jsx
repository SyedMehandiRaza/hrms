import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdAdd, MdInfoOutline, MdLockOutline, MdReceiptLong } from "react-icons/md";

import Loader from "../Loader";
import AdjustmentModal from "./AdjustmentModal";
import { getSettlement } from "../../data/groupG";
import { useFormat } from "../../hooks/useFormat";

// Final settlement of one exit (FE-7). While in notice: an estimate (nothing
// is posted yet). Once exited: the lines posted to payroll, totals, loan
// actions and the payroll run status. HR can add adjustment lines until that
// month's payroll is locked.
//   <SettlementPanel exit={exit} onChanged={reload} />

const OPEN_RUN_STATUSES = ["NOT_GENERATED", "DRAFT", "REJECTED"];
const CLOSED_EXIT_STATUSES = ["COMPLETED", "CANCELLED"];
const KIND_STYLES = {
  ENCASHMENT: "bg-cyan-50 text-cyan-700 border-cyan-200",
  LOAN_RECOVERY: "bg-amber-50 text-amber-700 border-amber-200",
  ADJUSTMENT: "bg-violet-50 text-violet-700 border-violet-200",
};
const RUN_STYLES = {
  NOT_GENERATED: "bg-gray-100 text-gray-600 border-gray-200",
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CREDITED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const chip = "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap";
const th = "px-4 py-2.5 text-xs font-semibold text-gray-500 text-start whitespace-nowrap";
const td = "px-4 py-3 text-sm text-gray-700";

// locked / lockTitle → the exit's year is closed + locked: no new adjustments.
export default function SettlementPanel({ exit, onChanged, locked = false, lockTitle }) {
  const { t } = useTranslation("exits");
  const { fmtDate, fmtNumber } = useFormat();
  const [modalOpen, setModalOpen] = useState(false);
  const loading = false;
  const failed = false;

  const exitId = exit?.id;
  const exitStatus = exit?.status;
  const eventCount = exit?.events?.length || 0;

  // Re-read the static settlement whenever the exit changes (status / events).
  const [loaded, setLoaded] = useState(() => ({ sig: `${exitId}|${exitStatus}|${eventCount}`, data: exitId ? getSettlement(exitId) : null }));
  const sig = `${exitId}|${exitStatus}|${eventCount}`;
  if (loaded.sig !== sig) setLoaded({ sig, data: exitId ? getSettlement(exitId) : null });
  const data = loaded.data;
  const setData = useCallback((d) => setLoaded((s) => ({ ...s, data: d })), []);
  const load = useCallback(() => {
    if (exitId) setData(getSettlement(exitId));
  }, [exitId, setData]);

  if (!exit) return null;

  const currency = data?.currency || data?.preview?.currency || "";
  const money = (v) => {
    const n = fmtNumber(Number(v || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${n} ${currency}` : n;
  };
  const monthLabel = (year, month) =>
    year && month ? fmtDate(new Date(Number(year), Number(month) - 1, 1), { year: "numeric", month: "long" }) : "—";

  const lwd = exit.notice?.last_working_day || "";
  const lwdMonthLabel = /^\d{4}-\d{2}/.test(lwd) ? monthLabel(lwd.slice(0, 4), lwd.slice(5, 7)) : "";
  const payroll = data?.payroll || null;
  const payrollLocked = !!payroll && !OPEN_RUN_STATUSES.includes(payroll.run_status);
  const exitClosed = CLOSED_EXIT_STATUSES.includes(exitStatus);
  const addDisabled = loading || failed || payrollLocked || exitClosed || locked;
  const addBlockedReason = locked
    ? lockTitle || ""
    : exitClosed
    ? t("settlement.addBlockedClosed", { status: t(`status.${exitStatus}`) })
    : payrollLocked
      ? t("settlement.addBlockedLocked", { month: monthLabel(payroll.year, payroll.month) })
      : "";

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{t("settlement.title")}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {data?.posted ? t("settlement.subtitlePosted") : t("settlement.subtitlePreview")}
        </p>
      </div>
      <div className="flex flex-col sm:items-end gap-1">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={addDisabled}
          title={addBlockedReason || undefined}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MdAdd className="text-base" />
          {t("settlement.addAdjustment")}
        </button>
        {addBlockedReason && (
          <p className="flex items-center gap-1 text-[11px] text-gray-500 sm:max-w-xs sm:text-end">
            <MdLockOutline className="shrink-0" />
            {addBlockedReason}
          </p>
        )}
      </div>
    </div>
  );

  const kindBadge = (kind) => (
    <span className={`${chip} ${KIND_STYLES[kind] || KIND_STYLES.ADJUSTMENT}`}>
      {t(`settlement.kind.${kind}`, { defaultValue: kind })}
    </span>
  );
  const typeText = (type) => (
    <span className={type === "DEDUCTION" ? "text-rose-600" : "text-emerald-700"}>{t(`adjustmentType.${type}`)}</span>
  );
  const signed = (l) => (
    <span className={`font-semibold tabular-nums ${l.type === "DEDUCTION" ? "text-rose-600" : "text-emerald-700"}`}>
      {l.type === "DEDUCTION" ? "−" : "+"}
      {money(l.amount)}
    </span>
  );

  const linesTable = (lines) => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-140">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className={th}>{t("settlement.colKind")}</th>
            <th className={th}>{t("settlement.colLabel")}</th>
            <th className={th}>{t("settlement.colType")}</th>
            <th className={`${th} text-end`}>{t("settlement.colAmount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lines.map((l, i) => (
            <tr key={`${l.kind}-${l.salary_transaction_id || i}`}>
              <td className={td}>{kindBadge(l.kind)}</td>
              <td className={td}>
                <div className="font-medium text-gray-900 wrap-break-word">{l.label}</div>
                {l.days != null && l.rate != null && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t("settlement.daysTimesRate", { days: fmtNumber(l.days), rate: money(l.rate) })}
                  </div>
                )}
              </td>
              <td className={td}>{typeText(l.type)}</td>
              <td className={`${td} text-end`}>{signed(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const totalsBox = (totals) => (
    <div className="mt-4 flex justify-end">
      <dl className="w-full sm:w-72 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-gray-500">{t("settlement.additions")}</dt>
          <dd className="font-medium text-emerald-700 tabular-nums">{money(totals?.additions)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-500">{t("settlement.deductions")}</dt>
          <dd className="font-medium text-rose-600 tabular-nums">{money(totals?.deductions)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-2">
          <dt className="font-semibold text-gray-900">{t("settlement.net")}</dt>
          <dd className={`font-bold tabular-nums ${Number(totals?.net) < 0 ? "text-rose-600" : "text-gray-900"}`}>
            {money(totals?.net)}
          </dd>
        </div>
      </dl>
    </div>
  );

  const payrollBox = payroll && (
    <div className="mt-5 rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">{t("settlement.payrollTitle")}</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <dt className="text-xs font-semibold text-gray-500">{t("settlement.payrollMonth")}</dt>
          <dd className="mt-1 text-sm text-gray-900">{monthLabel(payroll.year, payroll.month)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500">{t("settlement.payrollScope")}</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {payroll.project_id == null
              ? t("settlement.scopeCompany")
              : t("settlement.scopeProject", { id: payroll.project_id })}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500">{t("settlement.runStatus")}</dt>
          <dd className="mt-1">
            <span className={`${chip} ${RUN_STYLES[payroll.run_status] || RUN_STYLES.DRAFT}`}>
              {t(`payrollStatus.${payroll.run_status}`, { defaultValue: payroll.run_status })}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500">{t("settlement.payslipNet")}</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
            {payroll.payslip_net != null ? money(payroll.payslip_net) : t("settlement.noPayslip")}
          </dd>
        </div>
      </dl>
      {payroll.switched_month && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <MdInfoOutline className="shrink-0 mt-px text-sm" />
          {t("settlement.switchedMonth", { month: lwdMonthLabel || monthLabel(payroll.year, payroll.month) })}
        </p>
      )}
    </div>
  );

  let body;
  if (loading && !data) {
    body = <Loader />;
  } else if (!data) {
    body = (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <MdReceiptLong className="text-3xl text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">{t("settlement.loadFailed")}</p>
        <button type="button" onClick={load} className="mt-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800">
          {t("settlement.retry")}
        </button>
      </div>
    );
  } else if (!data.posted) {
    const pv = data.preview || {};
    const encash = !!exit.settlement_options?.encash_leave;
    const leaveRows = (pv.leave || []).filter((l) => Number(l.encashable_days) > 0);
    const loans = pv.loans || [];
    const handling = exit.settlement_options?.loan_handling;
    const adjustments = (data.lines || []).filter((l) => l.kind === "ADJUSTMENT");
    body = (
      <div className="space-y-5">
        <div className="flex items-start gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          <MdInfoOutline className="shrink-0 mt-0.5 text-base" />
          <div>
            <p className="font-semibold">{t("settlement.notPosted")}</p>
            <p className="text-xs mt-0.5">{t("settlement.notPostedHint")}</p>
          </div>
        </div>

        {encash && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">{t("settlement.encashTitle")}</h4>
            {pv.has_salary === false ? (
              <p className="text-sm text-gray-500">{t("settlement.noSalary")}</p>
            ) : leaveRows.length === 0 ? (
              <p className="text-sm text-gray-500">{t("settlement.noEncashable")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-120">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className={th}>{t("settlement.colLeaveType")}</th>
                      <th className={`${th} text-end`}>{t("settlement.colDays")}</th>
                      <th className={`${th} text-end`}>{t("settlement.colDailyRate")}</th>
                      <th className={`${th} text-end`}>{t("settlement.colAmount")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaveRows.map((l) => (
                      <tr key={l.leave_type_id}>
                        <td className={td}>
                          <span className="font-medium text-gray-900">{l.leave_name}</span>
                          {l.leave_code && <span className="ms-1.5 text-xs text-gray-400">{l.leave_code}</span>}
                          {l.cap != null && (
                            <div className="text-xs text-gray-500 mt-0.5">{t("settlement.capped", { cap: fmtNumber(l.cap) })}</div>
                          )}
                        </td>
                        <td className={`${td} text-end tabular-nums`}>{fmtNumber(l.encashable_days)}</td>
                        <td className={`${td} text-end tabular-nums`}>{money(pv.daily_rate)}</td>
                        <td className={`${td} text-end font-semibold text-emerald-700 tabular-nums`}>{money(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200 bg-gray-50">
                    <tr>
                      <td className={`${td} font-semibold text-gray-900`}>{t("settlement.estimatedTotal")}</td>
                      <td className={`${td} text-end font-semibold tabular-nums`}>{fmtNumber(pv.encashable_days)}</td>
                      <td className={td} />
                      <td className={`${td} text-end font-bold text-gray-900 tabular-nums`}>{money(pv.encashment_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-2">{t("settlement.loansTitle")}</h4>
          {loans.length === 0 ? (
            <p className="text-sm text-gray-500">{t("settlement.noLoans")}</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {loans.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-900">{l.loan_number}</span>
                    <span className="tabular-nums text-gray-700">{money(l.outstanding)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-600">
                {t("settlement.chosenHandling")}{" "}
                <span className="font-semibold text-gray-800">
                  {handling ? t(`loanHandling.${handling}`, { defaultValue: handling }) : "—"}
                </span>
              </p>
            </>
          )}
        </div>

        {adjustments.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">{t("settlement.adjustmentsTitle")}</h4>
            {linesTable(adjustments)}
          </div>
        )}
      </div>
    );
  } else {
    const lines = data.lines || [];
    const loans = data.loans || [];
    body = (
      <div>
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-gray-200">
            <MdReceiptLong className="text-3xl text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">{t("settlement.noLines")}</p>
          </div>
        ) : (
          linesTable(lines)
        )}
        {totalsBox(data.totals)}

        {loans.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">{t("settlement.loanActionsTitle")}</h4>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {loans.map((l) => (
                <li key={l.loan_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-2.5 text-sm">
                  <span className="font-medium text-gray-900">{l.loan_number}</span>
                  <span className="text-gray-600">{t(`settlement.loanAction.${l.action}`, { defaultValue: l.action })}</span>
                  <span className="tabular-nums font-semibold text-gray-800">{money(l.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
      {header}
      {body}
      {data && payrollBox}
      {currency && data && (
        <p className="mt-4 text-[11px] text-gray-400">{t("settlement.currencyNote", { currency })}</p>
      )}

      <AdjustmentModal
        isOpen={modalOpen}
        exitId={exit.id}
        currency={currency}
        onClose={() => setModalOpen(false)}
        onLocked={load}
        onSaved={(summary) => {
          if (summary) setData(summary);
          load();
          onChanged?.();
        }}
      />
    </section>
  );
}

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdOutlineArrowForward, MdOutlineHistory, MdOutlineUndo } from "react-icons/md";
import Pagination from "../Pagination";
import Loader from "../Loader";
import Ltr from "../Ltr";
import ConfirmationModal from "../ConfirmationModal";
import useYearLock from "../../hooks/useYearLock";
import { useFormat } from "../../hooks/useFormat";
import { paginate } from "../../data/common";
import { MY_EMPLOYEE_ID, getSalaryHistory, revertSalaryIncrement } from "../../data/groupE";

const LIMIT = 5;
const money = (n) =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n) => (n === null || n === undefined ? "—" : `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`);
const signedPct = (n) => (n === null || n === undefined ? null : `${n >= 0 ? "+" : "−"}${Math.abs(n)}%`);

const STATUS_STYLE = {
  CURRENT: "bg-cyan-100 text-cyan-700",
  SCHEDULED: "bg-violet-100 text-violet-700",
  PAST: "bg-gray-100 text-gray-600",
};

// The salary timeline of one employee: every salary row, newest first, with the
// increment that produced it and the change vs the previous row.
//   <SalaryHistory employeeId={id} canRevert reloadKey onChanged />   (admin)
//   <SalaryHistory self />                                            (my own, read-only)
export default function SalaryHistory({ employeeId, self = false, canRevert = false, reloadKey = 0, onChanged }) {
  const { t } = useTranslation("payroll");
  const { fmtDate } = useFormat();
  const lock = useYearLock();
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0); // bump → reload
  const [confirm, setConfirm] = useState(null); // the row to revert
  const [busy, setBusy] = useState(false);
  const loading = false;

  // The salary rows from the static store (reloadKey / tick → re-read).
  const who = self ? MY_EMPLOYEE_ID : employeeId;
  const all = who && reloadKey >= 0 && tick >= 0 ? getSalaryHistory(who, { self }) : [];
  const pg = paginate(all, page, LIMIT);
  const data = { rows: pg.rows, total: pg.total, total_pages: pg.totalPages };
  const load = useCallback(() => setTick((n) => n + 1), []);

  const statusOf = (r) => (r.scheduled ? "SCHEDULED" : r.is_current ? "CURRENT" : "PAST");

  const doRevert = async () => {
    if (!confirm?.increment) return;
    setBusy(true);
    try {
      revertSalaryIncrement(confirm.increment.id);
      toast.success(t("salaryHistory.toast.reverted"));
      setConfirm(null);
      if (page !== 1) setPage(1);
      else load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const cols = [
    t("salaryHistory.table.effective"),
    t("salaryHistory.table.basic"),
    t("salaryHistory.table.gross"),
    t("salaryHistory.table.change"),
    t("salaryHistory.table.reason"),
    ...(self ? [] : [t("salaryHistory.table.by")]),
    t("salaryHistory.table.status"),
    ...(self || !canRevert ? [] : [""]),
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
        <MdOutlineHistory className="text-xl text-cyan-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-base font-bold text-gray-900">{self ? t("salaryHistory.myTitle") : t("salaryHistory.title")}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{self ? t("salaryHistory.mySubtitle") : t("salaryHistory.subtitle")}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {cols.map((h, i) => (
                <th key={h || `c${i}`} className="text-start px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={cols.length}><Loader className="py-10" /></td></tr>
            ) : data.rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-5 py-8 text-center text-sm text-gray-400">{t("salaryHistory.empty")}</td></tr>
            ) : (
              data.rows.map((r) => {
                const c = r.change;
                const inc = r.increment;
                const st = statusOf(r);
                const locked = lock.isLockedDate(r.effective_from);
                return (
                  <tr key={r.salary_id} className="hover:bg-gray-50/60 align-top">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{fmtDate(r.effective_from)}</div>
                      {inc && inc.effective_date && inc.effective_date !== r.effective_from && (
                        <div className="text-xs text-gray-400">{t("salaryHistory.entered", { date: fmtDate(inc.effective_date) })}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Ltr>
                        {c && c.old_basic !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-gray-400">{money(c.old_basic)}</span>
                            <MdOutlineArrowForward className="text-gray-300" />
                            <span className="font-semibold text-gray-900">{money(r.basic)}</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-gray-900">{money(r.basic)}</span>
                        )}
                      </Ltr>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Ltr>
                        {c && c.old_gross !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-gray-400">{money(c.old_gross)}</span>
                            <MdOutlineArrowForward className="text-gray-300" />
                            <span className="font-semibold text-gray-900">{money(r.gross)}</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-gray-900">{money(r.gross)}</span>
                        )}
                        <span className="ms-1 text-xs text-gray-400">{r.currency}</span>
                      </Ltr>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {c && c.gross_diff !== null ? (
                        <Ltr>
                          <span className={`font-semibold ${c.gross_diff >= 0 ? "text-green-700" : "text-red-600"}`}>{signed(c.gross_diff)}</span>
                          {signedPct(c.gross_percent) && <span className="ms-1 text-xs text-gray-500">({signedPct(c.gross_percent)})</span>}
                        </Ltr>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-[260px]">
                      {inc ? (
                        <>
                          <div className="text-gray-800 break-words">{inc.reason || inc.title || "—"}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {t(`salaryHistory.kind.${inc.kind}`)} ·{" "}
                            <Ltr>{inc.type === "PERCENT" ? `${inc.value}%` : `+${money(inc.value)}`}</Ltr>
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-500">{t("salaryHistory.salarySetup")}</span>
                      )}
                    </td>
                    {!self && <td className="px-5 py-3.5 text-gray-700">{inc?.created_by?.name || "—"}</td>}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${STATUS_STYLE[st]}`}>
                        {t(`salaryHistory.status.${st}`)}
                      </span>
                    </td>
                    {!self && canRevert && (
                      <td className="px-5 py-3.5 text-end">
                        {r.can_revert && (
                          <button
                            type="button"
                            onClick={() => setConfirm(r)}
                            disabled={locked}
                            title={locked ? lock.titleFor(r.effective_from) : undefined}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <MdOutlineUndo className="text-sm" /> {t("salaryHistory.revert")}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {data.total > LIMIT && (
        <Pagination
          page={page}
          limit={LIMIT}
          total={data.total}
          totalPages={data.total_pages || 1}
          onPage={setPage}
          label={t("salaryHistory.paginationLabel")}
          activeClass="bg-cyan-600 text-white"
        />
      )}

      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => (busy ? null : setConfirm(null))}
        onConfirm={doRevert}
        type="warning"
        title={t("salaryHistory.confirm.title")}
        message={confirm ? t("salaryHistory.confirm.message", { date: fmtDate(confirm.effective_from) }) : ""}
        confirmText={t("salaryHistory.confirm.confirm")}
        isLoading={busy}
      />
    </div>
  );
}

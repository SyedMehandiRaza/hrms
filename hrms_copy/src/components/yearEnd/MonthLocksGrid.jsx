import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdLock, MdLockOpen, MdOutlineLockClock } from "react-icons/md";

import Loader from "../Loader";
import ReasonModal from "./ReasonModal";
import { LoadError } from "./shared";
import { listMonthLocks, lockMonth, unlockMonth } from "../../data/groupG";
import { STATIC_PERMISSION } from "../../data/session";
import { monthsOfFy } from "../../utils/fiscalYear";

// The 12 months of one FY (FY order) with their locks.
//   MANUAL            a lock somebody added (module + reason) → unlock with a reason
//   PAYROLL_CREDITED  MONTHLY lock mode: the month closed by its credited payroll
//                     (unlocked=true once the owner reopened it)
export default function MonthLocksGrid({ year, startMonth, canUpdate, onChanged }) {
  const { t } = useTranslation("fiscalYear");
  const [modal, setModal] = useState(null);
  // a month closed by its credited payroll: only the owner may reopen it
  const isOwner = !!STATIC_PERMISSION.isSuper; // { kind: "lock" | "unlock", month, lock? }

  const yearKey = year.year_key;
  const [loaded, setLoaded] = useState(() => ({ yearKey, rows: listMonthLocks(yearKey) }));
  if (loaded.yearKey !== yearKey) setLoaded({ yearKey, rows: listMonthLocks(yearKey) });
  const locks = loaded.rows;
  const setLocks = (rows) => setLoaded({ yearKey, rows });
  const remote = { data: locks, loading: false, error: null, reload: () => setLocks(listMonthLocks(yearKey)) };

  const yearLocked = !!year.is_locked;
  const lockedTitle = yearLocked ? t("locked.tooltip", { label: year.label }) : undefined;
  const months = monthsOfFy(startMonth, yearKey);
  const locksOf = (m) => locks.filter((l) => Number(l.period_year) === m.year && Number(l.period_month) === m.month);

  const submit = async ({ reason, module }) => {
    const m = modal.month;
    // reopening a payroll-credited month says so (it is not a MANUAL lock row)
    const payload = { period_year: m.year, period_month: m.month, module, reason, ...(modal.payroll ? { source: "PAYROLL_CREDITED" } : {}) };
    const rows = modal.kind === "lock" ? lockMonth(yearKey, payload) : unlockMonth(yearKey, payload);
    setLocks(rows || []);
    toast.success(modal.kind === "lock" ? t("locks.lockedToast") : t("locks.unlockedToast"));
    setModal(null);
    onChanged?.();
  };

  if (remote.loading && !remote.data) return <Loader className="py-8" />;
  if (remote.error && !remote.data) return <LoadError onRetry={remote.reload} />;

  const monthName = (m) => `${t(`monthFull.${m.key}`)} ${m.year}`;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {months.map((m) => {
          const rows = locksOf(m);
          const manual = rows.filter((l) => l.source !== "PAYROLL_CREDITED");
          const payroll = rows.find((l) => l.source === "PAYROLL_CREDITED");
          const isLocked = manual.length > 0 || (payroll && !payroll.unlocked);
          // a manual ALL lock keeps the month closed anyway → no payroll reopen while it exists
          const manualAll = manual.some((l) => l.module === "ALL");
          return (
            <div
              key={m.value}
              className={`rounded-xl border p-3 flex flex-col gap-2 ${isLocked ? "border-amber-200 bg-amber-50/40" : "border-gray-200 bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  {isLocked ? <MdLock className="text-amber-600" /> : <MdLockOpen className="text-gray-300" />}
                  {monthName(m)}
                </p>
                {canUpdate && (
                  <button
                    type="button"
                    disabled={yearLocked}
                    title={lockedTitle}
                    onClick={() => setModal({ kind: "lock", month: m })}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    {t("locks.lock")}
                  </button>
                )}
              </div>

              {payroll && (
                <div
                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                    payroll.unlocked ? "bg-gray-100 text-gray-600" : "bg-violet-50 text-violet-700"
                  }`}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <MdOutlineLockClock className="shrink-0" />
                    <span className="truncate">{payroll.unlocked ? t("locks.payrollReopened") : t("locks.payrollLocked")}</span>
                  </span>
                  {canUpdate && isOwner && !payroll.unlocked && !manualAll && (
                    <button
                      type="button"
                      disabled={yearLocked}
                      title={lockedTitle || t("locks.ownerOnly")}
                      onClick={() => setModal({ kind: "unlock", month: m, lock: { ...payroll, module: "ALL" }, payroll: true })}
                      className="shrink-0 font-semibold underline-offset-2 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("locks.unlock")}
                    </button>
                  )}
                </div>
              )}

              {manual.map((l) => (
                <div key={l.id || `${l.module}`} className="flex items-start justify-between gap-2 rounded-lg bg-white border border-amber-100 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-amber-700">{t(`lockModule.${l.module}`, { defaultValue: l.module })}</p>
                    {l.reason && <p className="text-[11px] text-gray-500 truncate" title={l.reason}>{l.reason}</p>}
                  </div>
                  {canUpdate && (
                    <button
                      type="button"
                      disabled={yearLocked}
                      title={lockedTitle}
                      onClick={() => setModal({ kind: "unlock", month: m, lock: l })}
                      className="shrink-0 text-[11px] font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("locks.unlock")}
                    </button>
                  )}
                </div>
              ))}

              {!rows.length && <p className="text-[11px] text-gray-400">{t("locks.open")}</p>}
            </div>
          );
        })}
      </div>

      {modal && (
        <ReasonModal
          title={modal.kind === "lock" ? t("locks.lockTitle", { month: monthName(modal.month) }) : t("locks.unlockTitle", { month: monthName(modal.month) })}
          intro={
            modal.kind === "lock"
              ? t("locks.lockIntro")
              : modal.payroll
                ? t("locks.payrollUnlockIntro")
                : t("locks.unlockIntro")
          }
          withModule
          fixedModule={modal.kind === "unlock" ? modal.lock.module : undefined}
          tone={modal.kind === "unlock" ? "danger" : "primary"}
          confirmText={modal.kind === "lock" ? t("locks.lock") : t("locks.unlock")}
          onSubmit={submit}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

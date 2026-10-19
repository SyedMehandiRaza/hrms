import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdCheckCircle, MdLock, MdLockOpen } from "react-icons/md";

import Loader from "../Loader";
import ConfirmationModal from "../ConfirmationModal";
import ReasonModal from "./ReasonModal";
import { ReadinessCard } from "./ReadinessStep";
import { ErrorBox } from "./shared";
import { DATETIME_OPTS, cardCls, dangerBtn, secondaryBtn } from "./styles";
import { closeFiscalYear, getReadiness, reopenFiscalYear } from "../../data/groupG";
import { STATIC_PERMISSION } from "../../data/session";
import { useFormat } from "../../hooks/useFormat";

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

// Summary → close (lock) the year; after closing, reopen within the window.
export default function CloseStep({ detail, pendingOnClose, readOnly, onChanged, onGoStep }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtDate, fmtNumber } = useFormat();
  const yearKey = detail.year_key;
  const closed = detail.status === "CLOSED";
  // only the company owner may reopen a closed year (the backend refuses others)
  const isOwner = !!STATIC_PERMISSION.isSuper;

  const [confirm, setConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [notReady, setNotReady] = useState(null);
  const [reopen, setReopen] = useState(false);

  // readiness only matters while the year is still open
  const ready = useMemo(() => (closed ? null : getReadiness(yearKey)), [yearKey, closed]);
  const loading = false;

  const doClose = async () => {
    setClosing(true);
    setNotReady(null);
    try {
      const d = closeFiscalYear(yearKey);
      toast.success(t("closeStep.closedToast", { label: detail.label }));
      setConfirm(false);
      onChanged?.(d);
    } catch {
      setConfirm(false);
      toast.error(t("ui.genericError"));
    } finally {
      setClosing(false);
    }
  };

  const doReopen = async ({ reason }) => {
    const d = reopenFiscalYear(yearKey, reason);
    toast.success(t("closeStep.reopenedToast", { label: detail.label }));
    setReopen(false);
    onChanged?.(d);
  };

  const money = (v) => fmtNumber(v, { maximumFractionDigits: 2 });
  const stepRows = (detail.steps || []).filter((s) => s.step !== "CLOSE");

  if (closed) {
    const totals = detail.totals || {};
    const payroll = totals.payroll;
    const leave = totals.leave;
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-4">
          <MdLock className="text-2xl text-gray-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{t("closeStep.closedTitle", { label: detail.label })}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {t("closeStep.closedOn", { date: fmtDate(detail.closed_at, DATETIME_OPTS) })}
              {detail.reopen_until && detail.can_reopen
                ? ` · ${t("closeStep.reopenUntil", { date: fmtDate(detail.reopen_until, DATETIME_OPTS) })}`
                : ""}
            </p>
          </div>
        </div>
        {payroll && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat label={t("closeStep.payslips")} value={fmtNumber(payroll.payslips)} />
            <Stat label={t("closeStep.gross")} value={money(payroll.gross)} />
            <Stat label={t("closeStep.deductions")} value={money(payroll.deductions)} />
            <Stat label={t("closeStep.net")} value={money(payroll.net)} />
          </div>
        )}
        {leave && typeof leave === "object" && (
          <p className="text-xs text-gray-500">{t("closeStep.leaveClosedNote")}</p>
        )}
        {!readOnly && isOwner && detail.can_reopen && (
          <div className={`${cardCls} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t("closeStep.reopenTitle")}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t("closeStep.reopenHint")}</p>
            </div>
            <button type="button" onClick={() => setReopen(true)} className={`${secondaryBtn} shrink-0`}>
              <MdLockOpen /> {t("closeStep.reopen")}
            </button>
          </div>
        )}
        {reopen && (
          <ReasonModal
            title={t("closeStep.reopenModalTitle", { label: detail.label })}
            intro={t("closeStep.reopenIntro")}
            confirmText={t("closeStep.reopen")}
            tone="danger"
            onSubmit={doReopen}
            onClose={() => setReopen(false)}
          />
        )}
      </div>
    );
  }

  if (loading) return <Loader />;

  const blocking = (ready?.items || []).filter((i) => i.status === "BLOCK");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label={t("closeStep.blocking")} value={fmtNumber(ready?.block || 0)} />
        <Stat label={t("closeStep.warnings")} value={fmtNumber(ready?.warn || 0)} />
        <Stat label={t("closeStep.stepsDone")} value={`${stepRows.filter((s) => s.status === "DONE" || s.status === "SKIPPED").length}/${stepRows.length}`} />
        <Stat label={t("closeStep.pendingRule")} value={pendingOnClose ? t(`pendingOnClose.${pendingOnClose}`) : "—"} />
      </div>

      <ul className={`${cardCls} divide-y divide-gray-100`}>
        {stepRows.map((s) => (
          <li key={s.step} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-700">{t(`steps.${s.step}`)}</span>
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                s.status === "DONE" ? "bg-emerald-50 text-emerald-700" : s.status === "SKIPPED" ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-700"
              }`}
            >
              {t(`stepStatus.${s.status}`)}
            </span>
          </li>
        ))}
      </ul>

      {notReady && (
        <div className="space-y-3">
          <ErrorBox message={notReady.message || t("closeStep.notReady")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notReady.items.map((it) => (
              <ReadinessCard key={it.key} item={it} yearKey={yearKey} onGoStep={onGoStep} />
            ))}
          </div>
        </div>
      )}
      {!notReady && blocking.length > 0 && (
        <div className="space-y-3">
          <ErrorBox message={t("closeStep.notReady")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {blocking.map((it) => (
              <ReadinessCard key={it.key} item={it} yearKey={yearKey} onGoStep={onGoStep} />
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 px-4 py-4">
          <div className="flex items-start gap-2.5 min-w-0">
            <MdCheckCircle className="text-xl text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{t("closeStep.closeHint", { label: detail.label })}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={closing || blocking.length > 0}
            title={blocking.length > 0 ? t("closeStep.notReady") : undefined}
            className={`${dangerBtn} shrink-0`}
          >
            <MdLock /> {t("closeStep.close", { label: detail.label })}
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirm}
        onClose={() => !closing && setConfirm(false)}
        onConfirm={doClose}
        isLoading={closing}
        type="delete"
        title={t("closeStep.confirmTitle", { label: detail.label })}
        message={t("closeStep.confirmMessage", { label: detail.label })}
        confirmText={t("closeStep.close", { label: detail.label })}
        cancelText={t("ui.cancel")}
      />
    </div>
  );
}

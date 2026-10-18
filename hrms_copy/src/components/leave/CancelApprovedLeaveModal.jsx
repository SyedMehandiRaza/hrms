import { useEffect, useState } from "react";
import { MdClose, MdOutlineEventBusy, MdOutlineError } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import FieldError from "../FieldError";
import Ltr from "../Ltr";
import { Spinner } from "../Loader";
import useYearLock from "../../hooks/useYearLock";
import { useFormat } from "../../hooks/useFormat";
import { cancelChecks, validateLeave, LEAVE_LIMITS } from "../../utils/fyValidation/leave";
import { LR_cancel, LR_REQUESTS, LR_save } from "../../data/groupD";

// Cancel an APPROVED leave — the deducted days come back to the balance.
//   <CancelApprovedLeaveModal open leave={row} scope="MY" | "ADMIN" onClose onDone />
// Static build: the cancel is applied to the in-memory sample list and the
// updated leave is passed to onDone(updated). Callers still pass scope="MY" or
// "ADMIN"; it no longer changes anything here.
// Reason 5–500 characters (same client rule as before).
export default function CancelApprovedLeaveModal({ open, leave, onClose, onDone }) {
  const { t } = useTranslation("leaves");
  const { fmtDate } = useFormat();
  const lock = useYearLock(leave?.from_date);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [refusal, setRefusal] = useState("");
  const saving = false;

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !leave) return null;

  const reset = () => {
    setReason("");
    setError("");
    setRefusal("");
  };
  const close = () => {
    if (saving) return;
    reset();
    onClose?.();
  };

  const submit = (e) => {
    e.preventDefault();
    if (saving || lock.locked) return;
    const errs = validateLeave(t, cancelChecks, { cancellation_reason: reason });
    setError(errs.cancellation_reason || "");
    setRefusal("");
    if (errs.cancellation_reason) return;
    const stored = LR_REQUESTS.find((r) => r.id === leave.id);
    const updated = stored ? LR_save(LR_cancel(stored, reason.trim())) : LR_cancel(leave, reason.trim());
    const restored = leave.total_days;
    toast.success(
      restored !== undefined && restored !== null
        ? t("fy.cancelLeave.successDays", { count: Number(restored) })
        : t("fy.cancelLeave.success"),
    );
    reset();
    onDone?.(updated);
  };

  const typeName =
    typeof leave.leave_type === "string" ? leave.leave_type : leave.leave_type?.leave_name || leave.leave_type?.name || "";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <MdOutlineEventBusy className="text-red-500 text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("fy.cancelLeave.title")}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t("fy.cancelLeave.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
            <MdClose className="text-xl" />
          </button>
        </div>
        <hr className="border-gray-100" />

        <form onSubmit={submit} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm">
              {leave.employee_name && <p className="font-semibold text-gray-900">{leave.employee_name}</p>}
              <p className="text-gray-700">
                {typeName}
                {leave.total_days !== undefined && (
                  <span className="text-gray-400"> · {t("fy.cancelLeave.days", { count: Number(leave.total_days) })}</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                <Ltr>
                  {fmtDate(leave.from_date)} – {fmtDate(leave.to_date)}
                </Ltr>
              </p>
            </div>

            {lock.locked && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{lock.title}</p>
            )}

            <div>
              <label htmlFor="cancel-reason" className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("fy.cancelLeave.reason")} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="cancel-reason"
                name="cancellation_reason"
                rows={3}
                maxLength={LEAVE_LIMITS.cancelReasonMax}
                disabled={lock.locked}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError("");
                }}
                placeholder={t("fy.cancelLeave.reasonPlaceholder")}
                className={`w-full border rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition resize-none ${
                  error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
                }`}
              />
              <FieldError message={error} />
            </div>

            {refusal && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <MdOutlineError className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{refusal}</p>
              </div>
            )}
            <p className="text-xs text-gray-400">{t("fy.cancelLeave.note")}</p>
          </div>

          <hr className="border-gray-100" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {t("fy.cancelLeave.keep")}
            </button>
            <button
              type="submit"
              disabled={saving || lock.locked}
              title={lock.locked ? lock.title : undefined}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Spinner size="sm" className="border-white border-t-transparent" />}
              {t("fy.cancelLeave.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

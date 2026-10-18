import { useEffect, useState } from "react";
import { MdClose, MdOutlineAdd, MdOutlineRemove, MdOutlineTune } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import FieldError from "../FieldError";
import Ltr from "../Ltr";
import { Spinner } from "../Loader";
import CarriedLeaveNote from "./CarriedLeaveNote";
import useYearLock from "../../hooks/useYearLock";
import { adjustChecks, validateLeave, LEAVE_LIMITS } from "../../utils/fyValidation/leave";

const labelCls = "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";
const inputCls = (err) =>
  `w-full border rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${
    err ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
  }`;

const r2 = (n) => Math.round(Number(n) * 100) / 100;

// Manual ± adjustment of one leave-balance row (POST /leave-balance/:id/adjust).
//   <AdjustLeaveBalanceModal open balance={row} employeeName onClose onDone />
// row: a leave_balances item (balance_id, name, balance, allocated, used,
// balance_status, carry_forward…). Same rules as the backend: days ≠ 0,
// |days| ≤ 365, 2 decimals, reason 10–500, never below zero.
export default function AdjustLeaveBalanceModal({ open, balance, employeeName, onClose, onDone }) {
  const { t } = useTranslation("leaves");
  const lock = useYearLock();
  const [mode, setMode] = useState("ADD"); // ADD | DEDUCT
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const saving = false;

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !balance) return null;

  const available = Number(balance.balance || 0);
  const closed = balance.balance_status === "CLOSED";
  const disabled = lock.locked || closed;
  const signed = amount === "" ? "" : (mode === "DEDUCT" ? -1 : 1) * Number(amount);
  const preview = amount !== "" && Number.isFinite(Number(amount)) ? r2(available + Number(signed)) : null;

  const reset = () => {
    setMode("ADD");
    setAmount("");
    setReason("");
    setErrors({});
    setFormError("");
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose?.();
  };

  const submit = (e) => {
    e.preventDefault();
    if (disabled || saving) return;
    const values = { days: signed, reason };
    const errs = validateLeave(t, adjustChecks, values, { available });
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    // Static build: the adjusted row (allocated and available move by ±days).
    const days = Number(signed);
    const updated = {
      ...balance,
      allocated: r2(Number(balance.allocated || 0) + days),
      balance: r2(available + days),
    };
    toast.success(t("fy.adjust.success"));
    reset();
    onDone?.(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
              <MdOutlineTune className="text-cyan-600 text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("fy.adjust.title")}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {employeeName ? `${employeeName} · ` : ""}
                {balance.name || balance.leave_name}
              </p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
            <MdClose className="text-xl" />
          </button>
        </div>
        <hr className="border-gray-100 flex-shrink-0" />

        <form onSubmit={submit} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
            {/* Current numbers */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { k: "fy.adjust.allocated", v: balance.allocated },
                { k: "fy.adjust.used", v: balance.used },
                { k: "fy.adjust.available", v: available, strong: true },
              ].map(({ k, v, strong }) => (
                <div key={k} className="bg-gray-50 border border-gray-100 rounded-xl py-2.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t(k)}</p>
                  <p className={`text-base font-bold ${strong ? "text-cyan-600" : "text-gray-800"}`}>
                    <Ltr>{Number(v || 0)}</Ltr>
                  </p>
                </div>
              ))}
            </div>
            <CarriedLeaveNote balance={balance} />

            {(lock.locked || closed) && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {closed ? t("fy.adjust.closedRow") : lock.title}
              </p>
            )}

            {/* Add / deduct */}
            <div>
              <label className={labelCls}>{t("fy.adjust.direction")}</label>
              <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1">
                {[
                  { v: "ADD", icon: MdOutlineAdd, label: t("fy.adjust.add") },
                  { v: "DEDUCT", icon: MdOutlineRemove, label: t("fy.adjust.deduct") },
                ].map(({ v, icon: Icon, label }) => (
                  <button
                    key={v}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setMode(v);
                      if (errors.days) setErrors((p) => ({ ...p, days: undefined }));
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                      mode === v ? "bg-white text-cyan-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="text-base" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="adjust-days">
                {t("fy.adjust.days")} <span className="text-red-500">*</span>
              </label>
              <input
                id="adjust-days"
                name="days"
                type="number"
                inputMode="decimal"
                min="0"
                max={LEAVE_LIMITS.adjustMax}
                step="0.5"
                disabled={disabled}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace("-", ""));
                  if (errors.days) setErrors((p) => ({ ...p, days: undefined }));
                }}
                placeholder={t("fy.adjust.daysPlaceholder")}
                className={inputCls(errors.days)}
              />
              <FieldError message={errors.days} />
              {preview !== null && !errors.days && (
                <p className={`text-xs mt-1.5 ${preview < 0 ? "text-red-500" : "text-gray-500"}`}>
                  {t("fy.adjust.newBalance")} <strong><Ltr>{preview}</Ltr></strong>
                </p>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="adjust-reason">
                {t("fy.adjust.reason")} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="adjust-reason"
                name="reason"
                rows={3}
                maxLength={LEAVE_LIMITS.adjustReasonMax}
                disabled={disabled}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errors.reason) setErrors((p) => ({ ...p, reason: undefined }));
                }}
                placeholder={t("fy.adjust.reasonPlaceholder")}
                className={`${inputCls(errors.reason)} resize-none`}
              />
              <div className="flex items-start justify-between gap-2">
                <FieldError message={errors.reason} />
                <span className="ms-auto text-[10px] text-gray-400 mt-1.5">
                  <Ltr>{reason.trim().length}/{LEAVE_LIMITS.adjustReasonMax}</Ltr>
                </span>
              </div>
            </div>

            {formError && <FieldError message={formError} />}
          </div>

          <hr className="border-gray-100 flex-shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 flex-shrink-0">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={disabled || saving}
              title={disabled ? (closed ? t("fy.adjust.closedRow") : lock.title) : undefined}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Spinner size="sm" className="border-white border-t-transparent" />}
              {saving ? t("fy.adjust.saving") : t("fy.adjust.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

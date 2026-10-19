import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { FiX } from "react-icons/fi";

import FieldError from "../FieldError";
import { Spinner } from "../Loader";
import { addAdjustment } from "../../data/groupG";
import { ADJUSTMENT_TYPES, exitRules } from "../../utils/exitValidation";

// "Add adjustment" — a one-off earning/deduction line on the final settlement
// (V18 type, V16/V19 label, V20 amount).
//   <AdjustmentModal isOpen exitId currency onClose onSaved={(summary) => …} />

const EMPTY = { type: "", label: "", amount: "" };
const inputBase = "w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500";
const inputCls = (bad) => `${inputBase} ${bad ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`;

export default function AdjustmentModal({ isOpen, exitId, currency, onClose, onSaved, onLocked }) {
  const { t } = useTranslation("exits");
  const rules = useMemo(() => exitRules(t), [t]);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange", defaultValues: EMPTY });
  const type = watch("type");
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    if (isOpen) reset(EMPTY);
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const close = () => {
    if (!saving) onClose?.();
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const summary = addAdjustment(exitId, {
        type: values.type,
        label: values.label.trim(),
        amount: Number(String(values.amount).trim()),
      });
      toast.success(t("adjustment.added"));
      onSaved?.(summary);
      onClose?.();
    } catch {
      // a payroll locked meanwhile: refresh the panel
      toast.error(t("adjustment.locked"));
      onClose?.();
      onLocked?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjustment-modal-title"
        className="w-full max-w-md bg-white rounded-xl shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h3 id="adjustment-modal-title" className="text-base font-semibold text-gray-900">
              {t("adjustment.title")}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{t("adjustment.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-5 py-4 space-y-4">
            <div>
              <span className="block text-xs font-semibold text-gray-500 mb-1.5">{t("adjustment.type")}</span>
              <div role="radiogroup" aria-invalid={!!errors.type} className="grid grid-cols-2 gap-2">
                {ADJUSTMENT_TYPES.map((v) => {
                  const active = type === v;
                  const tone =
                    v === "EARNING"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-rose-500 bg-rose-50 text-rose-700";
                  return (
                    <label
                      key={v}
                      className={`flex items-center justify-center gap-2 cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        active ? tone : errors.type ? "border-red-400 bg-red-50 text-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        value={v}
                        disabled={saving}
                        className="sr-only"
                        {...register("type", rules.adjustment_type)}
                      />
                      {t(`adjustmentType.${v}`)}
                    </label>
                  );
                })}
              </div>
              <FieldError error={errors.type} />
            </div>

            <div>
              <label htmlFor="adjustment-label" className="block text-xs font-semibold text-gray-500 mb-1.5">
                {t("adjustment.label")}
              </label>
              <input
                id="adjustment-label"
                type="text"
                maxLength={200}
                disabled={saving}
                placeholder={t("adjustment.labelPlaceholder")}
                aria-invalid={!!errors.label}
                className={inputCls(!!errors.label)}
                {...register("label", rules.label)}
              />
              <FieldError error={errors.label} />
            </div>

            <div>
              <label htmlFor="adjustment-amount" className="block text-xs font-semibold text-gray-500 mb-1.5">
                {currency ? t("adjustment.amountWithCurrency", { currency }) : t("adjustment.amount")}
              </label>
              <input
                id="adjustment-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                disabled={saving}
                placeholder={t("adjustment.amountPlaceholder")}
                aria-invalid={!!errors.amount}
                className={`${inputCls(!!errors.amount)} text-end`}
                {...register("amount", rules.amount)}
              />
              <FieldError error={errors.amount} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || hasErrors}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Spinner size="sm" className="border-white border-t-transparent" />}
              {saving ? t("common.saving") : t("adjustment.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

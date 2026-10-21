import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdClose, MdOutlineWarningAmber } from "react-icons/md";

import { cancelExit, withdrawExit } from "../../api/exits";
import { apiErrorMessage } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import { exitRules, LIMITS } from "../../utils/exitValidation";
import FieldError from "../FieldError";

// Cancel an exit that is still in notice (the employee stays on, D65), or with mode="withdraw"
// withdraw a pending one (D59). Both need a reason of 5–500 characters.
export default function CancelExitModal({ exit, mode = "cancel", onClose, onCancelled }) {
  const { t } = useTranslation("exits");
  const k = mode === "withdraw" ? "withdrawModal" : "cancelModal";
  const R = exitRules(t);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange", defaultValues: { cancel_reason: "" } });

  const len = String(useWatch({ control, name: "cancel_reason" }) || "").trim().length;
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async ({ cancel_reason }) => {
    let detail;
    try {
      detail = await (mode === "withdraw" ? withdrawExit : cancelExit)(exit.id, cancel_reason.trim());
    } catch (err) {
      const field = serverErrors(err).find((r) => r.field === "reason");
      if (field) setError("cancel_reason", { type: "server", message: field.message }, { shouldFocus: true });
      else toast.error(apiErrorMessage(err));
      return;
    }
    toast.success(t(`${k}.done`));
    onCancelled?.(detail);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{t(`${k}.title`)}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label={t("common.close")}>
            <MdClose className="text-xl" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-100 px-3 py-3">
            <MdOutlineWarningAmber className="text-xl text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              {t(`${k}.warning`, { name: exit?.employee?.full_name || t("list.unknownEmployee") })}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t(`${k}.reason`)}</label>
            <textarea
              rows={4}
              maxLength={LIMITS.cancelReasonMax}
              placeholder={t("cancelModal.reasonPlaceholder")}
              {...register("cancel_reason", R.cancel_reason)}
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none ${
                errors.cancel_reason ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
              }`}
            />
            <div className="flex items-start justify-between gap-3">
              <FieldError error={errors.cancel_reason} />
              <span className="ms-auto text-[11px] text-gray-400 mt-1.5 shrink-0">
                {len}/{LIMITS.cancelReasonMax}
              </span>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            {t(`${k}.keep`)}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || hasErrors}
            className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t(mode === "withdraw" ? "withdrawModal.withdrawing" : "cancelModal.cancelling") : t(`${k}.confirm`)}
          </button>
        </div>
      </form>
    </div>
  );
}

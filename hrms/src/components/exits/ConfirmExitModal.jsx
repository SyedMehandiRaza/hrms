import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdClose, MdOutlineWarningAmber } from "react-icons/md";

import { confirmExitImmediate } from "../../api/exits";
import { apiErrorMessage } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import { exitRules, LIMITS } from "../../utils/exitValidation";
import { useFormat } from "../../hooks/useFormat";
import useFiscalYear from "../../hooks/useFiscalYear";
import FieldError from "../FieldError";

// Confirm → Immediate (D64, the owner only): the last working day becomes today and the exit is
// processed now. The reason (10–500) is saved on the timeline. Checklist, documents and the
// "on the planned day" confirmation come later.
export default function ConfirmExitModal({ exit, onClose, onConfirmed }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const today = useFiscalYear().today;
  const R = exitRules(t, { overrideRequired: true });

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange", defaultValues: { override_reason: "" } });
  const reason = useWatch({ control, name: "override_reason" });
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (v) => {
    let detail;
    try {
      detail = await confirmExitImmediate(exit.id, String(v.override_reason || "").trim());
    } catch (err) {
      const field = serverErrors(err).find((r) => r.field === "reason");
      if (field) setError("override_reason", { type: "server", message: field.message }, { shouldFocus: true });
      else toast.error(apiErrorMessage(err));
      return;
    }
    toast.success(t("confirm.done"));
    onConfirmed?.(detail);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{t("confirm.immediateTitle")}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label={t("common.close")}>
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* who / when */}
          <div className="rounded-xl border border-gray-200">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{exit?.employee?.full_name || t("list.unknownEmployee")}</p>
                <p className="text-xs text-gray-500">
                  {t(`type.${exit?.exit_type}`)} · {t(`reason.${exit?.reason_category}`)}
                </p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-[11px] font-semibold text-gray-500">{t("confirm.lastWorkingDay")}</p>
                <p className="text-sm font-bold text-gray-900">{fmtDate(today)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <MdOutlineWarningAmber className="text-lg text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">{t("confirm.immediate")}</p>
              <p className="text-xs mt-0.5">{t("confirm.immediateHint")}</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-600">{t("confirm.accessEndsNow")}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="override_reason">
              {t("confirm.immediateReason")}
            </label>
            <textarea
              id="override_reason"
              rows={3}
              maxLength={LIMITS.overrideReasonMax}
              {...register("override_reason", R.override_reason)}
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none ${
                errors.override_reason ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
            />
            <div className="flex items-start justify-between gap-3">
              <FieldError error={errors.override_reason} />
              <span className="ms-auto text-[11px] text-gray-400 mt-1.5 shrink-0">
                {String(reason || "").trim().length}/{LIMITS.overrideReasonMax}
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
            {t("confirm.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || hasErrors}
            className="px-5 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t("confirm.submitting") : t("confirm.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

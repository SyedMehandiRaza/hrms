import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdClose, MdOutlineCheckCircle, MdOutlineWarningAmber, MdOutlineDescription } from "react-icons/md";

import { confirmExit } from "../../data/groupG";
import { STATIC_PERMISSION } from "../../data/session";
import { exitRules, LIMITS, todayYmd } from "../../utils/exitValidation";
import { useFormat } from "../../hooks/useFormat";
import { openRequiredItems, documentTypesFor } from "../../utils/exitConfirm";
import FieldError from "../FieldError";
import Ltr from "../Ltr";

// Settlement figures for the summary: posted totals, or the in-notice preview.
const settlementFigures = (exit) => {
  const s = exit?.settlement || {};
  if (s.totals) return { ...s.totals, currency: s.currency };
  const p = s.preview || {};
  const additions = exit?.settlement_options?.encash_leave ? Number(p.encashment_amount || 0) : 0;
  const deductions = exit?.settlement_options?.loan_handling === "RECOVER" ? Number(p.outstanding_loan_total || 0) : 0;
  return { additions, deductions, net: additions - deductions, currency: p.currency };
};

// "Confirm Termination / Resignation" (V27–V28). Owner-only override when
// required clearance items are still open.
export default function ConfirmExitModal({ exit, onClose, onConfirmed }) {
  const { t } = useTranslation("exits");
  const { fmtDate, fmtNumber } = useFormat();
  const isOwner = !!STATIC_PERMISSION.isSuper;
  const open = openRequiredItems(exit);
  const inNotice = exit?.status === "IN_NOTICE";
  const R = exitRules(t, { overrideRequired: open.length > 0 });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { mode: "ON_LWD", override_reason: "" },
  });
  const mode = useWatch({ control, name: "mode" });
  const reason = useWatch({ control, name: "override_reason" });
  const blocked = open.length > 0 && !isOwner;
  const hasErrors = Object.keys(errors).length > 0;
  const lwd = exit?.notice?.last_working_day;
  const money = settlementFigures(exit);
  const amount = (n) => <Ltr>{fmtNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Ltr>;
  const title = exit?.exit_type === "TERMINATION" ? t("confirm.titleTermination") : t("confirm.titleResignation");

  const onSubmit = async (v) => {
    try {
      const detail = confirmExit(exit.id, {
        mode: inNotice ? v.mode : "ON_LWD",
        override_reason: open.length ? String(v.override_reason || "").trim() : undefined,
      });
      toast.success(t("confirm.done"));
      onConfirmed?.(detail);
      onClose?.();
    } catch {
      toast.error(t("common.genericError"));
    }
  };

  const radio = (value, label, hint) => (
    <label
      className={`flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors ${
        mode === value ? "border-cyan-500 bg-cyan-50/60" : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <input type="radio" value={value} {...register("mode", R.mode)} className="mt-1 accent-cyan-600" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label={t("common.close")}>
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* who / when */}
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{exit?.employee?.full_name || t("list.unknownEmployee")}</p>
                <p className="text-xs text-gray-500">
                  {t(`type.${exit?.exit_type}`)} · {t(`reason.${exit?.reason_category}`)}
                </p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-[11px] font-semibold text-gray-500">{t("confirm.lastWorkingDay")}</p>
                <p className="text-sm font-bold text-gray-900">{fmtDate(inNotice && mode === "IMMEDIATE" ? todayYmd() : lwd)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
              {open.length ? (
                <MdOutlineWarningAmber className="text-lg text-amber-500 shrink-0" />
              ) : (
                <MdOutlineCheckCircle className="text-lg text-emerald-500 shrink-0" />
              )}
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{t("confirm.checklist")}: </span>
                {open.length ? t("confirm.checklistOpen", { count: open.length }) : t("confirm.checklistDone")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
              <div>
                <p className="text-[11px] font-semibold text-gray-500">{t("confirm.additions")}</p>
                <p className="text-sm font-bold text-emerald-700">{amount(money.additions)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500">{t("confirm.deductions")}</p>
                <p className="text-sm font-bold text-red-600">{amount(money.deductions)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500">{t("confirm.net")}</p>
                <p className="text-sm font-bold text-gray-900">{amount(money.net)}</p>
              </div>
            </div>
          </div>

          {/* when employment ends — only while serving notice */}
          {inNotice && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-gray-500 mb-1.5">{t("confirm.whenEnds")}</legend>
              {radio("ON_LWD", t("confirm.onLwd"), t("confirm.onLwdHint", { date: fmtDate(lwd) }))}
              {radio("IMMEDIATE", t("confirm.immediate"), t("confirm.immediateHint"))}
              <FieldError error={errors.mode} />
            </fieldset>
          )}
          <p className="text-xs font-semibold text-gray-600">
            {inNotice && mode === "IMMEDIATE"
              ? t("confirm.accessEndsNow")
              : t("confirm.accessEnds", { date: fmtDate(lwd) })}
          </p>

          {/* open items: owner override, everyone else is blocked */}
          {open.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">{t("confirm.overrideTitle")}</p>
                <ul className="mt-1 list-disc ps-5 text-xs text-amber-800">
                  {open.map((i) => (
                    <li key={i.id}>{i.label}</li>
                  ))}
                </ul>
              </div>
              {isOwner ? (
                <div>
                  <p className="text-xs text-amber-800 mb-2">{t("confirm.overrideHint")}</p>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="override_reason">
                    {t("confirm.overrideReason")}
                  </label>
                  <textarea
                    id="override_reason"
                    rows={3}
                    maxLength={LIMITS.overrideReasonMax}
                    placeholder={t("confirm.overridePlaceholder")}
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
              ) : (
                <p className="text-xs font-semibold text-red-700">{t("confirm.notAllowedOpen")}</p>
              )}
            </div>
          )}

          {/* documents */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">{t("confirm.documents")}</p>
            <ul className="space-y-1.5">
              {documentTypesFor(exit).map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-gray-700">
                  <MdOutlineDescription className="text-base text-cyan-600 shrink-0" />
                  {t(`documents.type.${d}`)}
                </li>
              ))}
            </ul>
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
            disabled={isSubmitting || hasErrors || blocked}
            className="px-5 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t("confirm.submitting") : t("confirm.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

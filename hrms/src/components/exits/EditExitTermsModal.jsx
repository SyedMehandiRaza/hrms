import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdClose, MdOutlineInfo } from "react-icons/md";

import { editExitTerms } from "../../api/exits";
import { useCurrentUser } from "../../hooks/useSession";
import { apiErrorMessage } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import {
  exitRules,
  computeLastWorkingDay,
  asBool,
  toDay,
  todayYmd,
  LOAN_HANDLING,
} from "../../utils/exitValidation";
import FieldError from "../FieldError";

// Editable terms (D65): the exit type and the notice start stay. Form field → API field.
const FIELDS = [
  "notice_days",
  "last_working_day",
  "preferred_last_day",
  "allow_leave_during_notice",
  "encash_leave",
  "loan_handling",
  "rehire_eligible",
  "cooling_period_days",
];

const API_FIELD = {
  notice_days: "noticeDays",
  last_working_day: "lastWorkingDay",
  preferred_last_day: "preferredLastDay",
  allow_leave_during_notice: "allowLeaveDuringNotice",
  encash_leave: "encashLeave",
  loan_handling: "loanHandling",
  rehire_eligible: "rehireEligible",
  cooling_period_days: "coolingPeriodDays",
};
const FORM_FIELD = Object.fromEntries(Object.entries(API_FIELD).map(([f, a]) => [a, f]));

const inputCls = (err) =>
  `w-full border rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
    err ? "border-red-400 bg-red-50" : "border-gray-200"
  }`;

// The exit's current terms as form values (radios hold "true"/"false").
const toForm = (exit) => {
  const lh = exit?.settlement_options?.loan_handling;
  return {
    notice_start_date: exit?.notice?.start_date || "",
    notice_days: exit?.notice?.days ?? "",
    last_working_day: exit?.notice?.last_working_day || "",
    preferred_last_day: exit?.notice?.preferred_last_day || "",
    allow_leave_during_notice: String(!!exit?.notice?.allow_leave_during_notice),
    encash_leave: String(!!exit?.settlement_options?.encash_leave),
    loan_handling: lh && lh !== "NONE" ? lh : "",
    rehire_eligible: String(!!exit?.rehire?.eligible),
    cooling_period_days: exit?.rehire?.cooling_period_days ?? "",
  };
};

// Form values → API types (trimmed strings, real numbers/booleans).
const normalize = (v) => ({
  notice_start_date: String(v.notice_start_date || "").trim(),
  notice_days: v.notice_days === "" ? null : Number(String(v.notice_days).trim()),
  last_working_day: String(v.last_working_day || "").trim(),
  preferred_last_day: String(v.preferred_last_day || "").trim() || null,
  allow_leave_during_notice: asBool(v.allow_leave_during_notice),
  encash_leave: asBool(v.encash_leave),
  loan_handling: v.loan_handling || null,
  rehire_eligible: asBool(v.rehire_eligible),
  cooling_period_days:
    v.cooling_period_days === "" || v.cooling_period_days === null || v.cooling_period_days === undefined
      ? null
      : Number(String(v.cooling_period_days).trim()),
});

export default function EditExitTermsModal({ exit, onClose, onSaved }) {
  const { t } = useTranslation("exits");
  // Loans come with the Payroll module: no balance to handle yet.
  const outstandingLoan = 0;
  const original = useMemo(() => toForm(exit), [exit]);
  const [lwdByHand, setLwdByHand] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange", defaultValues: original });

  const start = watch("notice_start_date");
  const rehireOn = asBool(watch("rehire_eligible"));
  const leaveOn = asBool(watch("allow_leave_during_notice"));

  // Only the company owner may move the LWD into the past (V7b); an unchanged
  // LWD is never re-checked.
  const isOwner = useCurrentUser()?.accessLevel === "ADMIN";
  const lwdCtx = { allowPastLwd: isOwner, originalLwd: original.last_working_day };
  const R = exitRules(t, { outstandingLoan, relaxStart: start === original.notice_start_date, ...lwdCtx });
  // An unchanged start date only has to be a real date (like the backend);
  // a changed one must be within the 90-day window again. Decided from the
  // value being validated, so it is never one render behind.
  const startRule = {
    validate: (v, f) =>
      exitRules(t, { outstandingLoan, relaxStart: v === original.notice_start_date, ...lwdCtx }).notice_start_date.validate(v, f),
  };
  const lwdMin =
    isOwner || (toDay(start) !== null && toDay(start) > toDay(todayYmd())) ? start || undefined : todayYmd();

  const recalcLwd = (nextStart, nextDays) => {
    if (lwdByHand) return;
    const lwd = computeLastWorkingDay(nextStart, nextDays);
    if (lwd) setValue("last_working_day", lwd, { shouldDirty: true, shouldValidate: true });
  };

  const startReg = register("notice_start_date", {
    ...startRule,
    onChange: (e) => {
      recalcLwd(e.target.value, watch("notice_days"));
      trigger(["last_working_day", "preferred_last_day"]);
    },
  });
  const daysReg = register("notice_days", {
    ...R.notice_days,
    onChange: (e) => recalcLwd(watch("notice_start_date"), e.target.value),
  });
  const lwdReg = register("last_working_day", {
    ...R.last_working_day,
    onChange: () => setLwdByHand(true),
  });
  const rehireReg = register("rehire_eligible", {
    ...R.rehire_eligible,
    onChange: () => {
      if (errors.cooling_period_days) trigger("cooling_period_days");
    },
  });

  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (values) => {
    const before = normalize(original);
    const after = normalize(values);
    const patch = {};
    FIELDS.forEach((k) => {
      if (k === "loan_handling" && !(outstandingLoan > 0)) return;
      if (k === "cooling_period_days" && !after.rehire_eligible) return;
      if (after[k] !== before[k]) patch[k] = after[k];
    });
    // Turning rehire on needs the cooling period with it.
    if (patch.rehire_eligible === true && patch.cooling_period_days === undefined) {
      patch.cooling_period_days = after.cooling_period_days;
    }
    if (Object.keys(patch).length === 0) {
      onClose?.();
      return;
    }
    let detail;
    try {
      detail = await editExitTerms(exit.id, Object.fromEntries(Object.entries(patch).map(([k, v]) => [API_FIELD[k], v])));
    } catch (err) {
      const rows = serverErrors(err).filter((row) => FORM_FIELD[row.field]);
      rows.forEach((row, i) => setError(FORM_FIELD[row.field], { type: "server", message: row.message }, { shouldFocus: i === 0 }));
      if (!rows.length) toast.error(apiErrorMessage(err));
      return;
    }
    toast.success(t("editTerms.saved"));
    onSaved?.(detail);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">{t("editTerms.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t("editTerms.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label={t("common.close")}>
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* notice */}
          <section className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900">{t("editTerms.sections.notice")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editTerms.fields.noticeStart")}</label>
                <input type="date" {...startReg} disabled className={`${inputCls(errors.notice_start_date)} disabled:bg-gray-50 disabled:text-gray-500`} />
                <FieldError error={errors.notice_start_date} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editTerms.fields.noticeDays")}</label>
                <input type="number" inputMode="numeric" min={0} {...daysReg} className={inputCls(errors.notice_days)} />
                <FieldError error={errors.notice_days} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editTerms.fields.lastWorkingDay")}</label>
                <input type="date" min={lwdMin} {...lwdReg} className={inputCls(errors.last_working_day)} />
                <FieldError error={errors.last_working_day} />
                {!errors.last_working_day && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    {lwdByHand ? t("editTerms.lwdManual") : t("editTerms.lwdAuto")}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {t("editTerms.fields.preferredLastDay")} <span className="font-normal text-gray-400">({t("editTerms.optional")})</span>
                </label>
                <input
                  type="date"
                  min={start || undefined}
                  {...register("preferred_last_day", R.preferred_last_day)}
                  className={inputCls(errors.preferred_last_day)}
                />
                <FieldError error={errors.preferred_last_day} />
              </div>
            </div>
            {exit?.notice?.extended_days > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-700">
                <MdOutlineInfo className="text-base shrink-0 mt-px" />
                <span>{t("editTerms.extensionNote", { days: t("common.days", { count: exit.notice.extended_days }) })}</span>
              </div>
            )}
            <YesNo
              label={t("editTerms.fields.allowLeave")}
              hint={leaveOn ? t("editTerms.allowLeaveYes") : t("editTerms.allowLeaveNo")}
              reg={register("allow_leave_during_notice", R.allow_leave_during_notice)}
              error={errors.allow_leave_during_notice}
            />
          </section>

          {/* settlement */}
          <section className="space-y-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-900">{t("editTerms.sections.settlement")}</h4>
            <YesNo
              label={t("editTerms.fields.encashLeave")}
              reg={register("encash_leave", R.encash_leave)}
              error={errors.encash_leave}
            />
            {outstandingLoan > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editTerms.fields.loanHandling")}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LOAN_HANDLING.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-sm cursor-pointer has-checked:border-cyan-500 has-checked:bg-cyan-50 ${
                        errors.loan_handling ? "border-red-400 bg-red-50" : "border-gray-200"
                      }`}
                    >
                      <input type="radio" value={opt} {...register("loan_handling", R.loan_handling)} className="accent-cyan-600" />
                      {t(`loanHandling.${opt}`)}
                    </label>
                  ))}
                </div>
                <FieldError error={errors.loan_handling} />
              </div>
            )}
          </section>

          {/* rehire */}
          <section className="space-y-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-900">{t("editTerms.sections.rehire")}</h4>
            <YesNo label={t("editTerms.fields.rehireEligible")} reg={rehireReg} error={errors.rehire_eligible} />
            {rehireOn && (
              <div className="sm:w-1/2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editTerms.fields.coolingDays")}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...register("cooling_period_days", R.cooling_period_days)}
                  className={inputCls(errors.cooling_period_days)}
                />
                <FieldError error={errors.cooling_period_days} />
              </div>
            )}
          </section>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || hasErrors || !isDirty}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

// Yes / No radio pair bound to react-hook-form ("true" / "false").
function YesNo({ label, hint, reg, error }) {
  const { t } = useTranslation("exits");
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      <div className="flex gap-2">
        {["true", "false"].map((v) => (
          <label
            key={v}
            className={`flex items-center gap-2 border rounded-lg px-4 py-2 text-sm cursor-pointer has-checked:border-cyan-500 has-checked:bg-cyan-50 has-checked:text-cyan-700 ${
              error ? "border-red-400 bg-red-50" : "border-gray-200"
            }`}
          >
            <input type="radio" value={v} {...reg} className="accent-cyan-600" />
            {v === "true" ? t("common.yes") : t("common.no")}
          </label>
        ))}
      </div>
      <FieldError error={error} />
      {hint && !error && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

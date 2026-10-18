import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlineClose,
  MdOutlineCheck,
  MdOutlineWarningAmber,
  MdOutlineInfo,
  MdOutlineLogout,
  MdOutlineGavel,
  MdOutlineRefresh,
  MdOutlineErrorOutline,
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
} from "react-icons/md";

import Loader from "../Loader";
import Ltr from "../Ltr";
import FieldError from "../FieldError";
import CustomDropdown from "../CustomDropdown";
import { useFormat } from "../../hooks/useFormat";
import { previewExit, raiseExit } from "../../data/groupG";
import { STATIC_PERMISSION } from "../../data/session";
import {
  exitRules,
  EXIT_TYPES,
  REASON_CATEGORIES,
  LOAN_HANDLING,
  LIMITS,
  asBool,
  toDay,
  todayYmd,
  computeLastWorkingDay,
  computeRehireAllowedFrom,
} from "../../utils/exitValidation";

// ─────────────────────────────────────────────────────────────────────────────
// Raise a resignation / termination — 4-step wizard (one form across steps).
// No approval step: the exit takes effect as soon as it is submitted.
// ─────────────────────────────────────────────────────────────────────────────

const STEP_FIELDS = {
  1: ["exit_type", "reason_category", "reason"],
  2: ["notice_start_date", "notice_days", "preferred_last_day", "last_working_day", "allow_leave_during_notice"],
  3: ["encash_leave", "loan_handling", "rehire_eligible", "cooling_period_days"],
};
const STEPS = [1, 2, 3, 4];

const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";
const inputCls = (err) =>
  `w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
    err ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
  }`;

const isWhole = (v) => /^\d+$/.test(String(v ?? "").trim());

// Yes / No segmented toggle bound to a boolean field.
function YesNo({ field, error, t }) {
  const value = field.value === true || field.value === "true";
  const opt = (v, label) => {
    const active = value === v;
    return (
      <button
        type="button"
        ref={v ? field.ref : undefined}
        onClick={() => {
          field.onChange(v);
          field.onBlur();
        }}
        aria-pressed={active}
        className={`flex-1 sm:flex-none sm:min-w-20 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
          active ? "bg-white text-cyan-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      className={`inline-flex w-full sm:w-auto p-1 rounded-lg border ${
        error ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-100"
      }`}
    >
      {opt(true, t("common.yes"))}
      {opt(false, t("common.no"))}
    </div>
  );
}

const Callout = ({ tone = "amber", icon: Icon = MdOutlineWarningAmber, children }) => {
  const tones = {
    amber: "bg-amber-50 border-amber-200 text-amber-800 [&_svg]:text-amber-500",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-800 [&_svg]:text-cyan-600",
    gray: "bg-gray-50 border-gray-200 text-gray-600 [&_svg]:text-gray-400",
    red: "bg-red-50 border-red-200 text-red-700 [&_svg]:text-red-500",
  };
  return (
    <div className={`flex items-start gap-2.5 border rounded-lg px-3.5 py-2.5 text-sm ${tones[tone]}`}>
      <Icon className="text-lg shrink-0 mt-px" />
      <div className="leading-relaxed min-w-0">{children}</div>
    </div>
  );
};

const SummaryRow = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5 sm:gap-4 py-2">
    <dt className="text-xs font-semibold text-gray-500 sm:pt-0.5 shrink-0">{label}</dt>
    <dd className="text-sm text-gray-900 sm:text-end break-words min-w-0">{children}</dd>
  </div>
);

export default function RaiseExitWizard({ isOpen, onClose, employeeId, employeeName, onRaised }) {
  const { t } = useTranslation("exits");
  const { fmtDate, fmtNumber } = useFormat();

  const [preview, setPreview] = useState(null);
  const loading = false;
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(1);
  const [topError, setTopError] = useState("");
  const [lwdManual, setLwdManual] = useState(false);

  // Load the static preview (defaults + settlement + handover warnings) on open.
  const openKey = isOpen && employeeId ? String(employeeId) : null;
  const [shownKey, setShownKey] = useState(null);
  if (openKey !== shownKey) {
    setShownKey(openKey);
    if (openKey) {
      const p = previewExit(employeeId);
      setPreview(p || null);
      setLoadError(p ? "" : t("common.genericError"));
      setStep(1);
      setTopError("");
      setLwdManual(false);
    }
  }

  // Only the company owner may backdate the last working day (V7b).
  const isOwner = !!STATIC_PERMISSION.isSuper;
  const outstandingLoan = Number(preview?.settlement?.outstanding_loan_total || 0);
  const hasLoan = outstandingLoan > 0;
  const R = useMemo(
    () => exitRules(t, { outstandingLoan, allowPastLwd: isOwner }),
    [t, outstandingLoan, isOwner],
  );

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setValue,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange" });

  const w = useWatch({ control });

  // Lock page scroll while open.
  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fill the form from the preview's defaults.
  useEffect(() => {
    if (!preview) return;
    const d = preview.defaults || {};
    reset({
      exit_type: "RESIGNATION",
      reason_category: "",
      reason: "",
      notice_start_date: d.notice_start_date || "",
      notice_days: d.notice_days ?? "",
      preferred_last_day: "",
      last_working_day: d.last_working_day || "",
      allow_leave_during_notice: !!d.allow_leave_during_notice,
      encash_leave: !!d.encash_leave,
      loan_handling: "",
      rehire_eligible: d.rehire_eligible !== false,
      cooling_period_days: d.cooling_period_days ?? "",
    });
  }, [preview, reset]);

  // Auto-derive the last working day from start + notice days until the user
  // sets it by hand.
  useEffect(() => {
    if (!preview || lwdManual) return;
    if (toDay(w.notice_start_date) === null || !isWhole(w.notice_days)) return;
    const next = computeLastWorkingDay(w.notice_start_date, Number(w.notice_days));
    if (next && next !== getValues("last_working_day")) {
      setValue("last_working_day", next, { shouldValidate: !!errors.last_working_day });
    }
  }, [w.notice_start_date, w.notice_days, lwdManual, preview, setValue, getValues, errors.last_working_day]);

  const recalcLwd = () => {
    setLwdManual(false);
    const next = computeLastWorkingDay(getValues("notice_start_date"), Number(getValues("notice_days")));
    if (next) setValue("last_working_day", next, { shouldValidate: true });
  };

  const close = useCallback(() => {
    if (!isSubmitting) onClose?.();
  }, [isSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const stepTitles = {
    1: t("wizard.steps.type"),
    2: t("wizard.steps.notice"),
    3: t("wizard.steps.settlement"),
    4: t("wizard.steps.review"),
  };

  const goNext = async () => {
    const fields = STEP_FIELDS[step];
    if (fields) {
      const ok = await trigger(fields, { shouldFocus: true });
      if (!ok) {
        // Mark the step's fields touched so each error clears as soon as it is fixed.
        fields.forEach((f) => setValue(f, getValues(f), { shouldTouch: true }));
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 4));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const settlement = preview?.settlement || {};
  const currency = settlement.currency || "";
  const money = (v) =>
    `${fmtNumber(Number(v || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

  const rehireEligible = asBool(w.rehire_eligible);
  const rehireFrom =
    rehireEligible && toDay(w.last_working_day) !== null && isWhole(w.cooling_period_days)
      ? computeRehireAllowedFrom(w.last_working_day, Number(w.cooling_period_days))
      : null;
  const reasonLen = (w.reason || "").trim().length;
  // Date picker floor for the LWD: the notice start, and never before today
  // unless the owner is backdating.
  const startDay = toDay(w.notice_start_date);
  const lwdMin =
    isOwner || (startDay !== null && startDay > toDay(todayYmd()))
      ? w.notice_start_date || undefined
      : todayYmd();

  const onSubmit = async (v) => {
    setTopError("");
    const payload = {
      employee_id: Number(employeeId),
      exit_type: v.exit_type,
      reason_category: v.reason_category,
      reason: String(v.reason || "").trim(),
      notice_start_date: v.notice_start_date,
      notice_days: Number(v.notice_days),
      last_working_day: v.last_working_day,
      allow_leave_during_notice: asBool(v.allow_leave_during_notice),
      encash_leave: asBool(v.encash_leave),
      rehire_eligible: asBool(v.rehire_eligible),
    };
    if (v.preferred_last_day) payload.preferred_last_day = v.preferred_last_day;
    if (hasLoan) payload.loan_handling = v.loan_handling;
    if (payload.rehire_eligible) payload.cooling_period_days = Number(v.cooling_period_days);

    try {
      const exit = raiseExit(payload);
      toast.success(t("wizard.toast.raised"));
      onRaised?.(exit);
    } catch {
      toast.error(t("common.genericError"));
    }
  };

  const onFormSubmit = (e) => {
    e.preventDefault();
    if (step < 4) goNext();
    else handleSubmit(onSubmit)(e);
  };

  const hasErrors = Object.keys(errors).length > 0;
  const name = preview?.employee?.full_name || employeeName || "";

  // ── step bodies ────────────────────────────────────────────────────────────
  const stepType = (
    <div className="space-y-5">
      <div>
        <span className={labelCls}>{t("wizard.fields.exitType")}</span>
        <Controller
          name="exit_type"
          control={control}
          rules={R.exit_type}
          render={({ field }) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup">
              {EXIT_TYPES.map((type, i) => {
                const active = field.value === type;
                const Icon = type === "RESIGNATION" ? MdOutlineLogout : MdOutlineGavel;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    ref={i === 0 ? field.ref : undefined}
                    onClick={() => {
                      if (field.value !== type) {
                        field.onChange(type);
                        setValue("reason_category", "", { shouldValidate: !!errors.reason_category });
                      }
                      field.onBlur();
                    }}
                    className={`flex items-start gap-3 text-start p-4 rounded-xl border-2 transition-colors ${
                      active
                        ? type === "TERMINATION"
                          ? "border-red-400 bg-red-50/60"
                          : "border-cyan-500 bg-cyan-50/60"
                        : errors.exit_type
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        active
                          ? type === "TERMINATION"
                            ? "bg-red-100 text-red-600"
                            : "bg-cyan-100 text-cyan-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Icon className="text-lg rtl:-scale-x-100" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-gray-900">{t(`type.${type}`)}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {type === "RESIGNATION" ? t("wizard.hints.resignation") : t("wizard.hints.termination")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        />
        <FieldError error={errors.exit_type} />
      </div>

      <div>
        <label className={labelCls} htmlFor="exit-reason-category">
          {t("wizard.fields.reasonCategory")}
        </label>
        <Controller
          name="reason_category"
          control={control}
          rules={R.reason_category}
          render={({ field }) => (
            <CustomDropdown
              id="exit-reason-category"
              ref={field.ref}
              name={field.name}
              value={field.value || ""}
              onChange={(e) => {
                field.onChange(e?.target ? e.target.value : e);
                field.onBlur();
              }}
              onBlur={field.onBlur}
              error={!!errors.reason_category}
              placeholder={t("wizard.placeholders.reasonCategory")}
              options={(REASON_CATEGORIES[w.exit_type] || []).map((c) => ({
                value: c,
                label: t(`reason.${c}`),
              }))}
            />
          )}
        />
        <FieldError error={errors.reason_category} />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-xs font-semibold text-gray-500" htmlFor="exit-reason">
            {t("wizard.fields.reason")}
          </label>
          <span
            className={`text-[11px] tabular-nums ${
              reasonLen > LIMITS.reasonMax || (reasonLen > 0 && reasonLen < LIMITS.reasonMin)
                ? "text-red-500"
                : "text-gray-400"
            }`}
          >
            <Ltr>
              {reasonLen}/{LIMITS.reasonMax}
            </Ltr>
          </span>
        </div>
        <textarea
          id="exit-reason"
          rows={4}
          placeholder={t("wizard.placeholders.reason")}
          {...register("reason", R.reason)}
          className={`${inputCls(errors.reason)} resize-none`}
        />
        <FieldError error={errors.reason} />
      </div>
    </div>
  );

  const stepNotice = (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="exit-notice-start">
            {t("wizard.fields.noticeStart")}
          </label>
          <input
            id="exit-notice-start"
            type="date"
            {...register("notice_start_date", {
              ...R.notice_start_date,
              deps: ["last_working_day", "preferred_last_day"],
            })}
            className={inputCls(errors.notice_start_date)}
          />
          <FieldError error={errors.notice_start_date} />
        </div>
        <div>
          <label className={labelCls} htmlFor="exit-notice-days">
            {t("wizard.fields.noticeDays")}
          </label>
          <input
            id="exit-notice-days"
            type="number"
            min={0}
            max={LIMITS.noticeDaysMax}
            step={1}
            inputMode="numeric"
            {...register("notice_days", R.notice_days)}
            className={inputCls(errors.notice_days)}
          />
          <FieldError error={errors.notice_days} />
        </div>
        <div>
          <label className={labelCls} htmlFor="exit-preferred">
            {t("wizard.fields.preferredLastDay")}{" "}
            <span className="font-normal text-gray-400">{t("wizard.optional")}</span>
          </label>
          <input
            id="exit-preferred"
            type="date"
            {...register("preferred_last_day", R.preferred_last_day)}
            className={inputCls(errors.preferred_last_day)}
          />
          <FieldError error={errors.preferred_last_day} />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-semibold text-gray-500" htmlFor="exit-lwd">
              {t("wizard.fields.lastWorkingDay")}
            </label>
            {lwdManual ? (
              <button
                type="button"
                onClick={recalcLwd}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 hover:text-cyan-700"
              >
                <MdOutlineRefresh /> {t("wizard.recalculate")}
              </button>
            ) : (
              <span className="text-[11px] text-gray-400">{t("wizard.autoCalculated")}</span>
            )}
          </div>
          <input
            id="exit-lwd"
            type="date"
            min={lwdMin}
            {...register("last_working_day", {
              ...R.last_working_day,
              onChange: () => setLwdManual(true),
            })}
            className={inputCls(errors.last_working_day)}
          />
          <FieldError error={errors.last_working_day} />
        </div>
      </div>

      <div>
        <span className={labelCls}>{t("wizard.fields.allowLeave")}</span>
        <Controller
          name="allow_leave_during_notice"
          control={control}
          rules={R.allow_leave_during_notice}
          render={({ field }) => <YesNo field={field} error={errors.allow_leave_during_notice} t={t} />}
        />
        <FieldError error={errors.allow_leave_during_notice} />
        <div className="mt-2.5">
          <Callout tone={asBool(w.allow_leave_during_notice) ? "cyan" : "gray"} icon={MdOutlineInfo}>
            {asBool(w.allow_leave_during_notice) ? t("wizard.hints.leaveAllowed") : t("wizard.hints.leaveBlocked")}
          </Callout>
        </div>
      </div>
    </div>
  );

  const stepSettlement = (
    <div className="space-y-6">
      {/* Leave encashment */}
      <div>
        <span className={labelCls}>{t("wizard.fields.encashLeave")}</span>
        <Controller
          name="encash_leave"
          control={control}
          rules={R.encash_leave}
          render={({ field }) => <YesNo field={field} error={errors.encash_leave} t={t} />}
        />
        <FieldError error={errors.encash_leave} />
        <div
          className={`mt-3 rounded-xl border p-4 transition-opacity ${
            asBool(w.encash_leave) ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"
          }`}
        >
          <p className="text-xs font-semibold text-gray-500 mb-3">{t("wizard.settlement.previewTitle")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-gray-400">{t("wizard.settlement.encashableDays")}</p>
              <p className="text-sm font-bold text-gray-900">
                <Ltr>{fmtNumber(Number(settlement.encashable_days || 0), { maximumFractionDigits: 2 })}</Ltr>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">{t("wizard.settlement.dailyRate")}</p>
              <p className="text-sm font-bold text-gray-900">
                <Ltr>{money(settlement.daily_rate)}</Ltr>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">{t("wizard.settlement.estimatedAmount")}</p>
              <p className="text-sm font-bold text-cyan-700">
                <Ltr>{money(asBool(w.encash_leave) ? settlement.encashment_amount : 0)}</Ltr>
              </p>
            </div>
          </div>
          {Array.isArray(settlement.leave) && settlement.leave.some((l) => Number(l.encashable_days) > 0) && (
            <ul className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              {settlement.leave
                .filter((l) => Number(l.encashable_days) > 0)
                .map((l) => (
                  <li key={l.leave_type_id} className="flex items-center justify-between gap-3 text-xs text-gray-600">
                    <span className="truncate">{l.leave_name}</span>
                    <span className="shrink-0 tabular-nums">
                      {t("common.days", { count: Number(l.encashable_days) })}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          {settlement.has_salary === false && (
            <div className="mt-3">
              <Callout tone="gray" icon={MdOutlineInfo}>
                {t("wizard.settlement.noSalary")}
              </Callout>
            </div>
          )}
          {!asBool(w.encash_leave) && (
            <p className="mt-3 text-xs text-gray-500">{t("wizard.settlement.notEncashing")}</p>
          )}
        </div>
      </div>

      {/* Loan handling */}
      {hasLoan && (
        <div>
          <span className={labelCls}>{t("wizard.fields.loanHandling")}</span>
          <Callout tone="amber">
            <span>
              {t("wizard.settlement.outstandingLoan")}{" "}
              <span className="font-bold">
                <Ltr>{money(outstandingLoan)}</Ltr>
              </span>
            </span>
            {Array.isArray(settlement.loans) && settlement.loans.length > 0 && (
              <span className="block text-xs mt-0.5">
                {settlement.loans.map((l, i) => (
                  <span key={l.id}>
                    {i > 0 && ", "}
                    <Ltr>{l.loan_number}</Ltr> (<Ltr>{money(l.outstanding)}</Ltr>)
                  </span>
                ))}
              </span>
            )}
          </Callout>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup">
            {LOAN_HANDLING.map((opt) => (
              <label
                key={opt}
                className={`flex items-center gap-2.5 px-3.5 py-3 rounded-lg border cursor-pointer text-sm transition-colors ${
                  w.loan_handling === opt
                    ? "border-cyan-500 bg-cyan-50/60 text-gray-900 font-semibold"
                    : errors.loan_handling
                      ? "border-red-300 bg-red-50 text-gray-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <input
                  type="radio"
                  value={opt}
                  {...register("loan_handling", R.loan_handling)}
                  className="accent-cyan-600 w-4 h-4 shrink-0"
                />
                {t(`loanHandling.${opt}`)}
              </label>
            ))}
          </div>
          <FieldError error={errors.loan_handling} />
        </div>
      )}

      {/* Rehire */}
      <div>
        <span className={labelCls}>{t("wizard.fields.rehireEligible")}</span>
        <Controller
          name="rehire_eligible"
          control={control}
          rules={{ ...R.rehire_eligible, deps: ["cooling_period_days"] }}
          render={({ field }) => <YesNo field={field} error={errors.rehire_eligible} t={t} />}
        />
        <FieldError error={errors.rehire_eligible} />
        {rehireEligible && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:items-start">
            <div>
              <label className={labelCls} htmlFor="exit-cooling">
                {t("wizard.fields.coolingDays")}
              </label>
              <input
                id="exit-cooling"
                type="number"
                min={0}
                max={LIMITS.coolingDaysMax}
                step={1}
                inputMode="numeric"
                {...register("cooling_period_days", R.cooling_period_days)}
                className={inputCls(errors.cooling_period_days)}
              />
              <FieldError error={errors.cooling_period_days} />
            </div>
            <div className="sm:pt-6">
              {rehireFrom ? (
                <p className="text-sm text-gray-600">
                  {t("wizard.rehireFrom")}{" "}
                  <span className="font-semibold text-gray-900">{fmtDate(rehireFrom)}</span>
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const warnings = preview?.warnings || {};
  const names = (rows) => rows.map((r) => r.name).filter(Boolean).join(", ");
  const yn = (v) => (asBool(v) ? t("common.yes") : t("common.no"));

  const stepReview = (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 px-4">
        <div className="py-3">
          <p className="text-xs font-semibold text-cyan-700">{stepTitles[1]}</p>
          <dl className="divide-y divide-gray-50">
            <SummaryRow label={t("wizard.fields.exitType")}>{w.exit_type ? t(`type.${w.exit_type}`) : "—"}</SummaryRow>
            <SummaryRow label={t("wizard.fields.reasonCategory")}>
              {w.reason_category ? t(`reason.${w.reason_category}`) : "—"}
            </SummaryRow>
            <SummaryRow label={t("wizard.fields.reason")}>
              <span className="whitespace-pre-line">{(w.reason || "").trim() || "—"}</span>
            </SummaryRow>
          </dl>
        </div>
        <div className="py-3">
          <p className="text-xs font-semibold text-cyan-700">{stepTitles[2]}</p>
          <dl className="divide-y divide-gray-50">
            <SummaryRow label={t("wizard.fields.noticeStart")}>{fmtDate(w.notice_start_date)}</SummaryRow>
            <SummaryRow label={t("wizard.fields.noticeDays")}>
              {isWhole(w.notice_days) ? t("common.days", { count: Number(w.notice_days) }) : "—"}
            </SummaryRow>
            {w.preferred_last_day ? (
              <SummaryRow label={t("wizard.fields.preferredLastDay")}>{fmtDate(w.preferred_last_day)}</SummaryRow>
            ) : null}
            <SummaryRow label={t("wizard.fields.lastWorkingDay")}>
              <span className="font-semibold">{fmtDate(w.last_working_day)}</span>
            </SummaryRow>
            <SummaryRow label={t("wizard.fields.allowLeave")}>{yn(w.allow_leave_during_notice)}</SummaryRow>
          </dl>
        </div>
        <div className="py-3">
          <p className="text-xs font-semibold text-cyan-700">{stepTitles[3]}</p>
          <dl className="divide-y divide-gray-50">
            <SummaryRow label={t("wizard.fields.encashLeave")}>
              {yn(w.encash_leave)}
              {asBool(w.encash_leave) && (
                <span className="text-gray-500">
                  {" · "}
                  <Ltr>{money(settlement.encashment_amount)}</Ltr>
                </span>
              )}
            </SummaryRow>
            {hasLoan && (
              <SummaryRow label={t("wizard.fields.loanHandling")}>
                {w.loan_handling ? t(`loanHandling.${w.loan_handling}`) : "—"}
                <span className="text-gray-500">
                  {" · "}
                  <Ltr>{money(outstandingLoan)}</Ltr>
                </span>
              </SummaryRow>
            )}
            <SummaryRow label={t("wizard.fields.rehireEligible")}>{yn(w.rehire_eligible)}</SummaryRow>
            {rehireEligible && (
              <SummaryRow label={t("wizard.fields.coolingDays")}>
                {isWhole(w.cooling_period_days) ? t("common.days", { count: Number(w.cooling_period_days) }) : "—"}
                {rehireFrom && (
                  <span className="block text-xs text-gray-500">
                    {t("wizard.rehireFrom")} {fmtDate(rehireFrom)}
                  </span>
                )}
              </SummaryRow>
            )}
          </dl>
        </div>
      </div>

      {(warnings.approval_groups?.length > 0 ||
        Number(warnings.pending_approvals) > 0 ||
        warnings.projects?.length > 0 ||
        warnings.deployments?.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">{t("wizard.handover.title")}</p>
          {warnings.approval_groups?.length > 0 && (
            <Callout>
              {t("wizard.handover.approvalGroups", { count: warnings.approval_groups.length })}{" "}
              <span className="font-semibold">{names(warnings.approval_groups)}</span>
            </Callout>
          )}
          {Number(warnings.pending_approvals) > 0 && (
            <Callout>{t("wizard.handover.pendingApprovals", { count: Number(warnings.pending_approvals) })}</Callout>
          )}
          {warnings.projects?.length > 0 && (
            <Callout>
              {t("wizard.handover.projects", { count: warnings.projects.length })}{" "}
              <span className="font-semibold">{names(warnings.projects)}</span>
            </Callout>
          )}
          {warnings.deployments?.length > 0 && (
            <Callout>
              {t("wizard.handover.deployments", { count: warnings.deployments.length })}{" "}
              <span className="font-semibold">{names(warnings.deployments)}</span>
            </Callout>
          )}
        </div>
      )}

      <Callout tone="red" icon={MdOutlineErrorOutline}>
        <span className="font-semibold">{t("wizard.immediate")}</span>
      </Callout>
    </div>
  );

  // ── shell ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="raise-exit-title"
        className="bg-white w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col sm:rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 shrink-0">
          <div className="min-w-0">
            <h2 id="raise-exit-title" className="text-base font-bold text-gray-900">
              {t("wizard.title")}
            </h2>
            {name && <p className="text-sm text-gray-500 mt-0.5 truncate">{t("wizard.subtitle", { name })}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            aria-label={t("common.close")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 disabled:opacity-50"
          >
            <MdOutlineClose className="text-xl" />
          </button>
        </div>

        {/* Progress */}
        {preview && (
          <div className="px-5 sm:px-6 pb-4 shrink-0">
            <ol className="flex items-center">
              {STEPS.map((s, i) => {
                const done = s < step;
                const current = s === step;
                return (
                  <li key={s} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                          done
                            ? "bg-cyan-600 text-white"
                            : current
                              ? "bg-cyan-50 text-cyan-700 ring-2 ring-cyan-600"
                              : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {done ? <MdOutlineCheck className="text-sm" /> : s}
                      </span>
                      <span
                        className={`text-xs font-semibold whitespace-nowrap ${current ? "text-gray-900" : "text-gray-400"} ${
                          current ? "inline" : "hidden md:inline"
                        }`}
                      >
                        {stepTitles[s]}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <span className={`flex-1 h-px mx-2 sm:mx-3 ${done ? "bg-cyan-600" : "bg-gray-200"}`} />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <hr className="border-gray-100 shrink-0" />

        <form onSubmit={onFormSubmit} noValidate className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
            {loading ? (
              <Loader label={t("wizard.loadingPreview")} />
            ) : loadError ? (
              <Callout tone="red" icon={MdOutlineErrorOutline}>
                {loadError}
              </Callout>
            ) : preview ? (
              <>
                {topError && (
                  <div className="mb-4">
                    <Callout tone="red" icon={MdOutlineErrorOutline}>
                      {topError}
                    </Callout>
                  </div>
                )}
                {/* All steps stay mounted (hidden) so one form validates every field. */}
                <div className={step === 1 ? "" : "hidden"}>{stepType}</div>
                <div className={step === 2 ? "" : "hidden"}>{stepNotice}</div>
                <div className={step === 3 ? "" : "hidden"}>{stepSettlement}</div>
                <div className={step === 4 ? "" : "hidden"}>{stepReview}</div>
              </>
            ) : null}
          </div>

          <hr className="border-gray-100 shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 shrink-0">
            <div>
              {preview && step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-5 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <MdOutlineChevronLeft className="text-lg rtl:rotate-180" />
                  {t("common.back")}
                </button>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={close}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {preview ? t("common.cancel") : t("common.close")}
              </button>
              {preview && step < 4 && (
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-5 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                >
                  {t("common.next")}
                  <MdOutlineChevronRight className="text-lg rtl:rotate-180" />
                </button>
              )}
              {preview && step === 4 && (
                <button
                  type="submit"
                  disabled={isSubmitting || hasErrors}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isSubmitting
                    ? t("wizard.submitting")
                    : w.exit_type === "TERMINATION"
                      ? t("wizard.submitTermination")
                      : t("wizard.submitResignation")}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

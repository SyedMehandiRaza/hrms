import { useEffect, useState } from "react";
import { MdClose, MdOutlineHistory, MdOutlineEventRepeat } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { useForm, useWatch, Controller } from "react-hook-form";
import { toast } from "react-toastify";
import CustomDropdown from "./CustomDropdown";
import FieldError from "./FieldError";
import Ltr from "./Ltr";
import Loader, { Spinner } from "./Loader";
import useFiscalYear from "../hooks/useFiscalYear";
import { useFormat } from "../hooks/useFormat";
import { fyLabel, yearKeyFor } from "../utils/fiscalYear";
import { createLeaveType, createLeaveTypeVersion, updateLeaveType } from "../api/leaveTypes";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage } from "../utils/apiError";
import {
  leaveCheck,
  leaveRule,
  DEFAULT_POLICY_FY,
  LEAVE_LIMITS,
  YEAR_END_EXCESS,
  ACCRUAL_METHODS,
} from "../utils/fyValidation/leave";

const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";

const inputCls =
  "w-full border border-gray-200 bg-white rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition";

const errCls = (err) => (err ? "border-red-400 bg-red-50" : "");

const ToggleRow = ({ checked, onChange, title, subtitle, disabled }) => (
  <div
    className={`flex items-center justify-between border rounded-xl px-4 py-3 transition-colors ${
      checked ? "bg-cyan-50 border-cyan-200" : "bg-white border-gray-200"
    }`}
  >
    <div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        checked ? "bg-cyan-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
          checked ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0.5 rtl:-translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

// Two-option segmented control (LAPSE / ENCASH, MONTHLY_ACCRUAL / UPFRONT).
const Segmented = ({ value, onChange, options, invalid }) => (
  <div className={`grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1 ${invalid ? "ring-1 ring-red-400" : ""}`}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        aria-pressed={value === o.value}
        className={`py-2 rounded-lg text-sm font-semibold transition-all ${
          value === o.value ? "bg-white text-cyan-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const ymd = (v) => (v ? String(v).slice(0, 10) : "");

// API field → form field, so the server's field errors land under the right input.
const FIELD_MAP = {
  code: "leave_code",
  is_paid: "paymentType",
  allow_half_day: "halfDay",
  requires_document: "requiresDocument",
  allow_negative_balance: "allowNegativeBalance",
  allow_carry_forward: "carryForward",
  max_carry_forward_days: "maxCarryForwardDays",
  allow_encashment: "encashment",
  max_encashment_days: "maxEncashmentDays",
};
const FORM_FIELDS = [
  "name", "leave_code", "description", "is_active", "paymentType", "yearly_quota", "monthly_accrual",
  "carryForward", "maxCarryForwardDays", "encashment", "maxEncashmentDays", "halfDay", "requiresDocument",
  "allowNegativeBalance", "effective_from", "effective_to", "carry_forward_expiry_months", "year_end_excess",
  "accrual_method", "prorate_joiners",
];
// 409 codes that belong under one input.
const CODE_FIELDS = { LEAVE_TYPE_NAME_TAKEN: "name", LEAVE_TYPE_CODE_TAKEN: "leave_code" };

// An API item (the type and its one policy, flat) → form values.
const toForm = (lt, p, fallbackFrom) => ({
  name: lt?.name || "",
  description: lt?.description || "",
  leave_code: lt?.code || "",
  is_active: lt?.is_active === false ? "0" : "1",
  paymentType: lt?.is_paid === false ? "UNPAID" : "PAID",
  yearly_quota: p?.yearly_quota != null ? String(Number(p.yearly_quota)) : "",
  monthly_accrual: p?.monthly_accrual != null ? String(Number(p.monthly_accrual)) : "",
  carryForward: !!p?.allow_carry_forward,
  maxCarryForwardDays: p?.max_carry_forward_days != null && Number(p.max_carry_forward_days) > 0 ? String(Number(p.max_carry_forward_days)) : "5",
  encashment: !!p?.allow_encashment,
  maxEncashmentDays: p?.max_encashment_days != null && Number(p.max_encashment_days) > 0 ? String(Number(p.max_encashment_days)) : "5",
  halfDay: !!lt?.allow_half_day,
  requiresDocument: !!lt?.requires_document,
  allowNegativeBalance: !!p?.allow_negative_balance,
  effective_from: p ? ymd(p.effective_from) : fallbackFrom || "",
  effective_to: p ? ymd(p.effective_to) : "",
  carry_forward_expiry_months: String(p?.carry_forward_expiry_months ?? DEFAULT_POLICY_FY.carry_forward_expiry_months),
  year_end_excess: p?.year_end_excess || DEFAULT_POLICY_FY.year_end_excess,
  accrual_method: p?.accrual_method || DEFAULT_POLICY_FY.accrual_method,
  prorate_joiners: p?.prorate_joiners === undefined ? DEFAULT_POLICY_FY.prorate_joiners : !!p.prorate_joiners,
});

// The financial-year rules of a policy (PUT /leave-policies/:id).
const fyRules = (d) => ({
  carry_forward_expiry_months: d.carry_forward_expiry_months === "" ? 0 : Number(d.carry_forward_expiry_months),
  year_end_excess: d.year_end_excess,
  accrual_method: d.accrual_method,
  prorate_joiners: !!d.prorate_joiners,
});

export default function CreateLeaveTypeModal({
  onClose,
  onSuccess,
  initialData = null,
  mode = "create",
}) {
  const { t } = useTranslation("leaves");
  const fy = useFiscalYear();
  const { fmtDate } = useFormat();
  const isEditMode = mode === "edit" && !!initialData;

  // Edit: the list row is the API item (the type and its one policy).
  const detail = isEditMode
    ? { loaded: true, leaveType: initialData, policy: initialData.policy_id ? { ...initialData, id: initialData.policy_id } : null, error: "" }
    : { loaded: true, leaveType: null, policy: null, error: "" };
  // No versioning yet (D30): edits change the one policy in place.
  const versions = [];
  const createdId = null;
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [versionFrom, setVersionFrom] = useState("");
  const [versionError, setVersionError] = useState("");
  const [versionSaving, setVersionSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    setError,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    defaultValues: isEditMode
      ? toForm(detail.leaveType, detail.policy)
      : toForm(null, null, fy.range?.from),
  });

  const carryForward = useWatch({ control, name: "carryForward" });
  const encashment = useWatch({ control, name: "encashment" });
  const policy = detail.policy;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // The form → the POST/PUT body (the type and its one policy).
  const toBody = (data) => ({
    name: data.name.trim(),
    code: data.leave_code,
    description: data.description?.trim() || null,
    is_paid: data.paymentType === "PAID",
    allow_half_day: data.halfDay,
    requires_document: data.requiresDocument,
    allow_negative_balance: data.allowNegativeBalance,
    is_active: data.is_active === "1",
    yearly_quota: data.yearly_quota === "" ? 0 : Number(data.yearly_quota),
    monthly_accrual: data.monthly_accrual === "" ? 0 : Number(data.monthly_accrual),
    // Empty = the start of the current financial year / no end date.
    effective_from: data.effective_from || null,
    effective_to: data.effective_to || null,
    allow_carry_forward: data.carryForward,
    max_carry_forward_days: data.carryForward ? Number(data.maxCarryForwardDays) : 0,
    allow_encashment: data.encashment,
    max_encashment_days: data.encashment ? Number(data.maxEncashmentDays) : 0,
    ...fyRules(data),
  });

  const onSubmit = async (data) => {
    if (saving) return;
    setFormError("");
    setSaving(true);
    let saved;
    try {
      saved = isEditMode ? await updateLeaveType(initialData.id, toBody(data)) : await createLeaveType(toBody(data));
    } catch (err) {
      setSaving(false);
      const code = apiErrorCode(err);
      if (CODE_FIELDS[code]) {
        setError(CODE_FIELDS[code], { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
        return;
      }
      const { mapped, unmapped } = applyFieldErrors(err, setError, { fieldMap: FIELD_MAP, knownFields: FORM_FIELDS });
      if (!mapped.length || unmapped.length) setFormError(unmapped[0] || apiErrorMessage(err));
      return;
    }
    setSaving(false);
    toast.success(isEditMode ? t("toast.leaveTypeUpdated") : t("toast.leaveTypeCreated"));
    onSuccess?.(saved);
    onClose();
  };

  // ── New version from a financial-year start ─────────────────────────────
  const latest = versions.length ? versions[versions.length - 1] : policy;
  const currentFrom = ymd(latest?.effective_from);
  const versionYears = fy.years.filter(
    (y) => y.status !== "CLOSED" && !y.is_locked && (!currentFrom || y.start_date > currentFrom),
  );
  const labelOfDate = (d) => {
    if (!d) return "";
    const y = fy.years.find((x) => x.start_date <= d && x.end_date >= d);
    return y?.label || fyLabel(fy.startMonth, yearKeyFor(fy.startMonth, d));
  };

  // "Save as new version" stays on screen; the server answers that versions aren't available
  // yet (D30), shown under the button.
  const saveVersion = async () => {
    if (!policy?.id || versionSaving) return;
    setFormError("");
    setVersionError("");
    setVersionSaving(true);
    try {
      await createLeaveTypeVersion(initialData.id);
    } catch (err) {
      setVersionError(apiErrorMessage(err));
    }
    setVersionSaving(false);
  };

  const blockEmoji = (field) => (e) => {
    const value = e.target.value;
    const stripped = value.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
    if (value !== stripped) {
      setValue(field, stripped, { shouldValidate: true, shouldDirty: true });
    }
  };

  const formatLeaveCode = (field) => (e) => {
    const value = e.target.value;
    const stripped = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value !== stripped) {
      setValue(field, stripped, { shouldValidate: true, shouldDirty: true });
    }
  };

  const onlyNumbers = (field) => (e) => {
    const value = e.target.value;
    const stripped = value.replace(/\D/g, "");
    if (value !== stripped) {
      setValue(field, stripped, { shouldValidate: true, shouldDirty: true });
    }
  };

  // digits + one decimal point (accrual can be 1.5 / month)
  const onlyDecimal = (field) => (e) => {
    const value = e.target.value;
    const stripped = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    if (value !== stripped) {
      setValue(field, stripped, { shouldValidate: true, shouldDirty: true });
    }
  };

  const busy = saving || versionSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEditMode ? t("createModal.editTitle") : t("createModal.createTitle")}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {isEditMode ? t("createModal.editSubtitle") : t("createModal.createSubtitle")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
            <MdClose className="text-xl" />
          </button>
        </div>

        <hr className="border-gray-100 flex-shrink-0" />

        {!detail.loaded ? (
          <Loader className="py-20" />
        ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
            {detail.error && <FieldError message={detail.error} />}

            <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                • {t("createModal.basicInformation")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className={labelCls}>{t("createModal.leaveName")}</label>
                  <input
                    placeholder={t("createModal.leaveNamePlaceholder")}
                    className={`${inputCls} ${errCls(errors.name)}`}
                    {...register("name", {
                      required: t("validation.leaveNameRequired"),
                      minLength: { value: 2, message: t("validation.min2") },
                      maxLength: { value: 150, message: t("validation.max150") },
                      onChange: blockEmoji("name"),
                    })}
                  />
                  <FieldError error={errors.name} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={isEditMode ? "col-span-1 sm:col-span-2" : "col-span-1 sm:col-span-3"}>
                  <div>
                    <label className={labelCls}>{t("createModal.leaveCode")}</label>
                    <input
                      placeholder={t("createModal.leaveCodePlaceholder")}
                      maxLength={10}
                      className={`${inputCls} ${errCls(errors.leave_code)}`}
                      {...register("leave_code", {
                        required: t("validation.leaveCodeRequired"),
                        onChange: formatLeaveCode("leave_code"),
                      })}
                    />
                    <FieldError error={errors.leave_code} />
                  </div>
                </div>
                {isEditMode && (
                  <div className="sm:col-span-1">
                    <label className={labelCls}>{t("createModal.status")}</label>
                    <Controller
                      name="is_active"
                      control={control}
                      render={({ field }) => (
                        <CustomDropdown
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={[
                            { label: t("createModal.active"), value: "1" },
                            { label: t("createModal.inactive"), value: "0" }
                          ]}
                        />
                      )}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>{t("createModal.description")}</label>
                <textarea
                  rows={4}
                  placeholder={t("createModal.descriptionPlaceholder")}
                  className={`${inputCls} resize-none`}
                  {...register("description", {
                    onChange: blockEmoji("description"),
                  })}
                />
              </div>

              <div>
                <label className={labelCls}>{t("createModal.paymentType")}</label>
                <Controller
                  name="paymentType"
                  control={control}
                  render={({ field }) => (
                    <Segmented
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "PAID", label: t("createModal.paid") },
                        { value: "UNPAID", label: t("createModal.unpaid") },
                      ]}
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                • {t("createModal.policyConfiguration")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t("createModal.totalYearlyQuota")}</label>
                  <input
                    inputMode="numeric"
                    placeholder={t("createModal.totalYearlyQuotaPlaceholder")}
                    className={`${inputCls} ${errCls(errors.yearly_quota)}`}
                    {...register("yearly_quota", {
                      ...leaveRule(t, leaveCheck.yearlyQuota),
                      onChange: onlyNumbers("yearly_quota"),
                    })}
                  />
                  <FieldError error={errors.yearly_quota} />
                </div>
                <div>
                  <label className={labelCls}>{t("createModal.monthlyAccrual")}</label>
                  <input
                    inputMode="decimal"
                    placeholder={t("createModal.monthlyAccrualPlaceholder")}
                    className={`${inputCls} ${errCls(errors.monthly_accrual)}`}
                    {...register("monthly_accrual", {
                      ...leaveRule(t, leaveCheck.monthlyAccrual),
                      onChange: onlyDecimal("monthly_accrual"),
                    })}
                  />
                  <FieldError error={errors.monthly_accrual} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t("createModal.effectiveFrom")}</label>
                  <input
                    type="date"
                    className={`${inputCls} ${errCls(errors.effective_from)}`}
                    {...register("effective_from")}
                  />
                  <FieldError error={errors.effective_from} />
                  {!errors.effective_from && fy.label && !isEditMode && (
                    <p className="text-[11px] text-gray-400 mt-1">{t("fy.policy.fromHint", { label: fy.label })}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>{t("createModal.effectiveTo")}</label>
                  <input
                    type="date"
                    className={`${inputCls} ${errCls(errors.effective_to)}`}
                    {...register("effective_to", leaveRule(t, leaveCheck.effectiveTo))}
                  />
                  <FieldError error={errors.effective_to} />
                  {!errors.effective_to && (
                    <p className="text-[11px] text-gray-400 mt-1">{t("fy.policy.toHint")}</p>
                  )}
                </div>
              </div>

              <Controller
                name="carryForward"
                control={control}
                render={({ field }) => (
                  <ToggleRow
                    checked={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      trigger("maxCarryForwardDays");
                    }}
                    title={t("createModal.carryForwardTitle")}
                    subtitle={t("createModal.carryForwardSubtitle")}
                  />
                )}
              />

              {carryForward && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t("createModal.maxCarryForwardDays")}</label>
                    <input
                      type="number"
                      min="0"
                      placeholder={t("createModal.maxCarryForwardDaysPlaceholder")}
                      className={`${inputCls} ${errCls(errors.maxCarryForwardDays)}`}
                      {...register("maxCarryForwardDays", {
                        ...leaveRule(t, leaveCheck.maxCarryForward),
                        onChange: onlyNumbers("maxCarryForwardDays"),
                      })}
                    />
                    <FieldError error={errors.maxCarryForwardDays} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("fy.policy.carryExpiry")}</label>
                    <input
                      type="number"
                      min="0"
                      max={LEAVE_LIMITS.carryExpiryMax}
                      step="1"
                      className={`${inputCls} ${errCls(errors.carry_forward_expiry_months)}`}
                      {...register("carry_forward_expiry_months", leaveRule(t, leaveCheck.carryExpiry))}
                    />
                    <FieldError error={errors.carry_forward_expiry_months} />
                    {!errors.carry_forward_expiry_months && (
                      <p className="text-[11px] text-gray-400 mt-1">{t("fy.policy.carryExpiryHint")}</p>
                    )}
                  </div>
                </div>
              )}

              <Controller
                name="encashment"
                control={control}
                render={({ field }) => (
                  <ToggleRow
                    checked={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      trigger("maxEncashmentDays");
                    }}
                    title={t("createModal.encashmentTitle")}
                    subtitle={t("createModal.encashmentSubtitle")}
                  />
                )}
              />

              {encashment && (
                <div>
                  <label className={labelCls}>{t("createModal.maxEncashmentDays")}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={t("createModal.maxEncashmentDaysPlaceholder")}
                    className={`${inputCls} ${errCls(errors.maxEncashmentDays)}`}
                    {...register("maxEncashmentDays", {
                      ...leaveRule(t, leaveCheck.maxEncashment),
                      onChange: onlyNumbers("maxEncashmentDays"),
                    })}
                  />
                  <FieldError error={errors.maxEncashmentDays} />
                </div>
              )}

              <div className="space-y-3">
                <Controller
                  name="halfDay"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      checked={field.value}
                      onChange={field.onChange}
                      title={t("createModal.halfDayTitle")}
                      subtitle={t("createModal.halfDaySubtitle")}
                    />
                  )}
                />
                <Controller
                  name="requiresDocument"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      checked={field.value}
                      onChange={field.onChange}
                      title={t("createModal.requiresDocumentTitle")}
                      subtitle={t("createModal.requiresDocumentSubtitle")}
                    />
                  )}
                />
                <Controller
                  name="allowNegativeBalance"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      checked={field.value}
                      onChange={field.onChange}
                      title={t("createModal.negativeBalanceTitle")}
                      subtitle={t("createModal.negativeBalanceSubtitle")}
                    />
                  )}
                />
              </div>
            </div>

            {/* ── Financial-year rules (year end + accrual) ── */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                • {t("fy.policy.section")}
              </p>

              <div>
                <label className={labelCls}>{t("fy.policy.yearEndExcess")}</label>
                <Controller
                  name="year_end_excess"
                  control={control}
                  rules={leaveRule(t, leaveCheck.yearEndExcess)}
                  render={({ field }) => (
                    <Segmented
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.year_end_excess}
                      options={YEAR_END_EXCESS.map((v) => ({ value: v, label: t(`fy.policy.excess.${v}`) }))}
                    />
                  )}
                />
                <FieldError error={errors.year_end_excess} />
                {!errors.year_end_excess && (
                  <p className="text-[11px] text-gray-400 mt-1">{t("fy.policy.yearEndExcessHint")}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>{t("fy.policy.accrualMethod")}</label>
                <Controller
                  name="accrual_method"
                  control={control}
                  rules={leaveRule(t, leaveCheck.accrualMethod)}
                  render={({ field }) => (
                    <Segmented
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.accrual_method}
                      options={ACCRUAL_METHODS.map((v) => ({ value: v, label: t(`fy.policy.method.${v}`) }))}
                    />
                  )}
                />
                <FieldError error={errors.accrual_method} />
              </div>

              <Controller
                name="prorate_joiners"
                control={control}
                rules={leaveRule(t, leaveCheck.prorateJoiners)}
                render={({ field }) => (
                  <ToggleRow
                    checked={field.value}
                    onChange={field.onChange}
                    title={t("fy.policy.prorateTitle")}
                    subtitle={t("fy.policy.prorateSubtitle")}
                  />
                )}
              />
              <FieldError error={errors.prorate_joiners} />
            </div>

            {/* ── Versions (edit) ── */}
            {isEditMode && policy?.id && (
              <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50/60">
                <div className="flex items-center gap-2">
                  <MdOutlineEventRepeat className="text-cyan-600 text-lg" />
                  <p className="text-sm font-bold text-gray-900">{t("fy.policy.versionTitle")}</p>
                </div>
                <p className="text-xs text-gray-500">{t("fy.policy.versionHint")}</p>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                  <div className="flex-1">
                    <CustomDropdown
                      value={versionFrom}
                      onChange={(e) => {
                        setVersionFrom(e.target.value);
                        setVersionError("");
                      }}
                      disabled={!versionYears.length}
                      placeholder={versionYears.length ? t("fy.policy.chooseYear") : t("fy.policy.noYears")}
                      options={[
                        { label: versionYears.length ? t("fy.policy.chooseYear") : t("fy.policy.noYears"), value: "" },
                        ...versionYears.map((y) => ({
                          label: t("fy.policy.fromYear", { label: y.label, date: fmtDate(y.start_date) }),
                          value: y.start_date,
                        })),
                      ]}
                    />
                    <FieldError message={versionError} />
                  </div>
                  <button
                    type="button"
                    onClick={saveVersion}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-cyan-700 border border-cyan-300 bg-white rounded-lg hover:bg-cyan-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {versionSaving && <Spinner size="sm" />}
                    {versionFrom
                      ? t("fy.policy.saveVersionFrom", { label: labelOfDate(versionFrom) })
                      : t("fy.policy.saveVersion")}
                  </button>
                </div>

                {versions.length > 0 && (
                  <div className="pt-1">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      <MdOutlineHistory /> {t("fy.policy.versionsList")}
                    </p>
                    <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
                      {versions.map((v, i) => {
                        const isLatest = i === versions.length - 1;
                        return (
                          <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800">
                                {v.effective_from ? labelOfDate(ymd(v.effective_from)) : t("fy.policy.noStart")}
                                {isLatest && (
                                  <span className="ms-2 inline-flex px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-100 text-[10px] font-bold">
                                    {t("fy.policy.latest")}
                                  </span>
                                )}
                              </p>
                              <p className="text-gray-400">
                                <Ltr>
                                  {v.effective_from ? fmtDate(ymd(v.effective_from)) : "—"} –{" "}
                                  {v.effective_to ? fmtDate(ymd(v.effective_to)) : t("fy.policy.noEnd")}
                                </Ltr>
                              </p>
                            </div>
                            <span className="text-gray-600 whitespace-nowrap">
                              {t("fy.policy.quotaDays", { count: Number(v.yearly_quota || 0) })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {formError && <FieldError message={formError} />}
          </div>

          <hr className="border-gray-100 flex-shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t("createModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Spinner size="sm" />}
              {saving
                ? isEditMode
                  ? t("createModal.updating")
                  : t("createModal.creating")
                : isEditMode || createdId
                  ? t("createModal.updateLeaveType")
                  : t("createModal.createLeaveType")}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

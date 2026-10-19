import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdClose, MdOutlineError, MdOutlinePayments } from "react-icons/md";
import CustomDropdown from "../../CustomDropdown";
import CustomMonthPicker from "../../CustomMonthPicker";
import FieldError from "../../FieldError";
import Ltr from "../../Ltr";
import { Spinner } from "../../Loader";
import { useFormat } from "../../../hooks/useFormat";
import { LS_ENCASH_EMPLOYEES, LS_encashmentOptions } from "../../../data/groupD";
import {
  ENCASHMENT_LIMITS,
  encashMonthLabel,
  encashmentCheck,
  encashmentContext,
  encashmentEstimate,
  encashmentRule,
} from "../../../utils/fyValidation/encashment";

const EMPTY = { employee_id: "", leave_type_id: "", days: "", payout_month: "", reason: "" };

// Request leave encashment — pay N days of leave in a chosen payroll month.
//   <RequestEncashmentModal open mode="SELF" | "ADMIN" onClose onDone />
// SELF  → POST /leave-encashments (the logged-in employee)
// ADMIN → POST /leave-encashments/on-behalf (employee picker first)
// The form's rules are utils/fyValidation/encashment (= the backend's); every
// error shows under its input, server errors too.
export default function RequestEncashmentModal({ open, mode = "SELF", onClose, onDone }) {
  const { t } = useTranslation("leaves");
  const { fmtNumber } = useFormat();
  const admin = mode === "ADMIN";
  const [refusal, setRefusal] = useState("");
  // employees for the on-behalf picker
  const employees = LS_ENCASH_EMPLOYEES;

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onTouched", defaultValues: EMPTY });

  const employeeId = watch("employee_id");
  const typeId = watch("leave_type_id");
  const days = watch("days");
  const month = watch("payout_month");
  const reason = watch("reason") || "";
  const wantKey = open && (!admin || employeeId) ? (admin ? String(employeeId) : "me") : null;
  // form options (self on open; admin once an employee is chosen)
  const options = useMemo(
    () => (wantKey ? LS_encashmentOptions(wantKey === "me" ? undefined : wantKey) : null),
    [wantKey],
  );
  const loadError = "";
  const loading = false;
  const ctx = useMemo(() => encashmentContext(options), [options]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (isSubmitting) return;
    reset(EMPTY);
    setRefusal("");
    onClose?.();
  };

  const types = options?.leave_types || [];
  const selectedType = types.find((x) => String(x.leave_type_id) === String(typeId)) || null;
  const estimate = encashmentEstimate(days, month, ctx);
  const currency = options?.currency || "";
  const money = (n) => `${currency ? `${currency} ` : ""}${fmtNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const noTypes = !!options && types.length === 0;

  const submit = handleSubmit((values) => {
    setRefusal("");
    const inactive = encashmentCheck.employee_id(null, values, ctx || {});
    if (inactive) {
      setError("employee_id", { type: "client", message: t(inactive) });
      return;
    }
    const payload = {
      leave_type_id: Number(values.leave_type_id),
      days: Number(values.days),
      payout_month: values.payout_month,
      ...(values.reason && values.reason.trim() ? { reason: values.reason.trim() } : {}),
    };
    // Static build: the new PENDING request, in the list-row shape.
    const emp = options?.employee || {};
    const rate = ctx?.rates?.[payload.payout_month] ?? null;
    const created = {
      id: null,
      employee: { id: emp.id, full_name: emp.full_name },
      leave_type: { id: payload.leave_type_id, name: selectedType?.leave_name || null },
      days: payload.days,
      payout_month: payload.payout_month,
      daily_rate: rate,
      amount_estimated: estimate,
      amount_final: null,
      amount: estimate,
      currency: currency || null,
      status: "PENDING",
      reason: payload.reason || null,
      reject_reason: null,
      raised_on_behalf: admin,
      created_at: new Date().toISOString(),
      can_cancel: true,
    };
    toast.success(admin ? t("encashment.toast.createdOnBehalf") : t("encashment.toast.created"));
    reset(EMPTY);
    onDone?.(created);
  });

  const inputCls = (bad) =>
    `w-full border rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${
      bad ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
    }`;
  const labelCls = "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="encash-title"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
              <MdOutlinePayments className="text-cyan-600 text-xl" />
            </div>
            <div>
              <h2 id="encash-title" className="text-lg font-bold text-gray-900">
                {admin ? t("encashment.modal.titleOnBehalf") : t("encashment.modal.title")}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">{t("encashment.modal.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label={t("encashment.modal.close")} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
            <MdClose className="text-xl" />
          </button>
        </div>
        <hr className="border-gray-100" />

        <form onSubmit={submit} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
            {admin && (
              <div data-field="employee_id">
                <label className={labelCls}>
                  {t("encashment.modal.employee")} <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="employee_id"
                  control={control}
                  rules={{ validate: (v) => (admin && !v ? t("encashment.validation.employeeRequired") : true) }}
                  render={({ field }) => (
                    <CustomDropdown
                      {...field}
                      isSearchable
                      error={!!errors.employee_id}
                      placeholder={t("encashment.modal.employeePlaceholder")}
                      options={employees.map((e) => ({
                        value: String(e.id),
                        label: `${e.full_name || "—"}${e.country_emp_id ? ` (${e.country_emp_id})` : ""}`,
                      }))}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        reset({ ...EMPTY, employee_id: e.target.value });
                      }}
                    />
                  )}
                />
                <FieldError error={errors.employee_id} />
              </div>
            )}

            {/* the employee's own status (inactive) — no input of its own in SELF mode */}
            {!admin && <FieldError error={errors.employee_id} />}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Spinner size="sm" /> {t("encashment.modal.loading")}
              </div>
            )}
            {loadError && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <MdOutlineError className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{loadError}</p>
              </div>
            )}
            {noTypes && (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">{t("encashment.modal.noTypes")}</p>
            )}
            {options?.employee?.last_working_day && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t("encashment.modal.noticeNote", { date: options.employee.last_working_day })}
              </p>
            )}

            {(!admin || employeeId) && (
              <>
                <div data-field="leave_type_id">
                  <label className={labelCls}>
                    {t("encashment.modal.leaveType")} <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="leave_type_id"
                    control={control}
                    rules={encashmentRule(t, "leave_type_id", ctx)}
                    render={({ field }) => (
                      <CustomDropdown
                        {...field}
                        error={!!errors.leave_type_id}
                        disabled={!options}
                        placeholder={t("encashment.modal.leaveTypePlaceholder")}
                        options={types.map((lt) => ({
                          value: String(lt.leave_type_id),
                          label: t("encashment.modal.typeOption", {
                            name: lt.leave_name || "—",
                            available: lt.available,
                            max: lt.encashable_max,
                          }),
                        }))}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                  <FieldError error={errors.leave_type_id} />
                  {selectedType && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      {selectedType.max_days > 0
                        ? t("encashment.modal.typeInfoCap", {
                            available: selectedType.available,
                            used: selectedType.already_encashed,
                            max: selectedType.max_days,
                            left: selectedType.encashable_max,
                          })
                        : t("encashment.modal.typeInfo", { available: selectedType.available })}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div data-field="days">
                    <label htmlFor="encash-days" className={labelCls}>
                      {t("encashment.modal.days")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="encash-days"
                      type="text"
                      inputMode="decimal"
                      placeholder={t("encashment.modal.daysPlaceholder")}
                      disabled={!options}
                      className={inputCls(!!errors.days)}
                      {...register("days", encashmentRule(t, "days", ctx))}
                    />
                    <FieldError error={errors.days} />
                  </div>
                  <div data-field="payout_month">
                    <label className={labelCls}>
                      {t("encashment.modal.payoutMonth")} <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="payout_month"
                      control={control}
                      rules={encashmentRule(t, "payout_month", ctx)}
                      render={({ field }) => (
                        <CustomMonthPicker
                          value={field.value}
                          onChange={(v) => {
                            field.onChange(v);
                            field.onBlur();
                          }}
                          fyBound={false}
                          min={options?.min_month}
                          max={options?.max_month}
                          disabled={!options}
                          containerClassName="w-full"
                          className={`w-full ${errors.payout_month ? "border-red-400 bg-red-50" : ""}`}
                        />
                      )}
                    />
                    <FieldError error={errors.payout_month} />
                    {options && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        <Ltr>
                          {t("encashment.modal.window", {
                            min: encashMonthLabel(options.min_month),
                            max: encashMonthLabel(options.max_month),
                          })}
                        </Ltr>
                        {options.closed_months?.length > 0 && (
                          <span className="block">
                            {t("encashment.modal.closedMonths", {
                              months: options.closed_months.map(encashMonthLabel).join(", "),
                            })}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-cyan-50/60 border border-cyan-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-cyan-700 uppercase tracking-wider">{t("encashment.modal.estimate")}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {month && ctx?.rates?.[month] !== undefined
                        ? t("encashment.modal.rate", { rate: money(ctx.rates[month]) })
                        : t("encashment.modal.estimateHint")}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gray-900" data-testid="encash-estimate">
                    <Ltr>{estimate === null ? "—" : money(estimate)}</Ltr>
                  </p>
                </div>

                <div data-field="reason">
                  <label htmlFor="encash-reason" className={labelCls}>
                    {t("encashment.modal.reason")}
                  </label>
                  <textarea
                    id="encash-reason"
                    rows={3}
                    disabled={!options}
                    placeholder={t("encashment.modal.reasonPlaceholder")}
                    className={`${inputCls(!!errors.reason)} resize-none`}
                    {...register("reason", encashmentRule(t, "reason", ctx))}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <FieldError error={errors.reason} />
                    <span className="text-[11px] text-gray-400 mt-1.5 ms-auto">
                      <Ltr>
                        {reason.length}/{ENCASHMENT_LIMITS.reasonMax}
                      </Ltr>
                    </span>
                  </div>
                </div>
              </>
            )}

            {refusal && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <MdOutlineError className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{refusal}</p>
              </div>
            )}
            <p className="text-xs text-gray-400">{t("encashment.modal.note")}</p>
          </div>

          <hr className="border-gray-100" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {t("encashment.modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loading || noTypes || (!admin && !options)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Spinner size="sm" className="border-white border-t-transparent" />}
              {t("encashment.modal.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

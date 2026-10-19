import { useEffect, useState } from "react";
import { MdClose } from "react-icons/md";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import CustomDropdown from "./CustomDropdown";
import CustomMonthPicker from "./CustomMonthPicker";
import useFiscalYear from "../hooks/useFiscalYear";
import { transactionRules } from "../utils/fyValidation/payroll";
import { EMPLOYEES } from "../data/common";
import { PAYROLL_PROJECTS, SALARY_COMPONENTS, addTransaction } from "../data/groupE";

export default function CreateTransactionModal({ isOpen, onClose, onSuccess, defaultMonth }) {
  const { t } = useTranslation("payroll");
  const fy = useFiscalYear();
  // A month of the selected financial year (the list's month when it is in it).
  const startMonth = defaultMonth && fy.inFy(defaultMonth) ? defaultMonth : fy.defaultMonth;
  const R = transactionRules(t);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      employeeId: "",
      projectId: "",
      month: startMonth,
      type: "EARNING",
      isAdvance: false,
      componentId: "",
      label: "",
      amount: "",
    },
  });

  const employeeId = watch("employeeId");
  const projectId = watch("projectId");
  const type = watch("type");
  const isAdvance = watch("isAdvance");
  const componentId = watch("componentId");
  const month = watch("month");

  const employees = EMPLOYEES;
  const projects = PAYROLL_PROJECTS;
  const components = SALARY_COMPONENTS.filter((c) => c.is_active);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    reset({
      employeeId: "", projectId: "", month: startMonth,
      type: "EARNING", isAdvance: false, componentId: "", label: "", amount: "",
    });
    // Re-seed on open and whenever the financial year changes.
  }, [isOpen, reset, startMonth, fy.version]);

  const onSubmit = async (data) => {
    const m = /^(\d{4})-(\d{2})$/.exec(data.month || "");
    if (!m) {
      setError("month", { type: "manual", message: t("transactionModal.toast.invalidMonth") });
      return;
    }
    setSubmitting(true);
    try {
      const row = addTransaction({
        employee_id: Number(data.employeeId),
        project_id: data.projectId ? Number(data.projectId) : null,
        period_year: Number(m[1]),
        period_month: Number(m[2]),
        type: data.isAdvance ? "DEDUCTION" : data.type,
        is_advance: !!data.isAdvance,
        salary_component_id: data.componentId ? Number(data.componentId) : null,
        label: data.label.trim(),
        amount: Number(data.amount),
      });
      toast.success(t("transactionModal.toast.added"));
      onSuccess?.(row);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = (err) =>
    `w-full h-[42px] border ${err ? "border-red-500" : "border-gray-200"} rounded-lg px-3 text-sm focus:outline-none focus:ring-1 ${err ? "focus:ring-red-500" : "focus:ring-cyan-500"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-0">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{t("transactionModal.title")}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[72vh]">
          <form id="create-transaction-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Employee */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("transactionModal.employee")} <span className="text-red-500">*</span></label>
              <CustomDropdown
                value={employeeId}
                onChange={(e) => setValue("employeeId", e.target.value, { shouldValidate: true })}
                placeholder={t("transactionModal.employeeSearch")}
                isSearchable
                options={employees.map((e) => ({ label: e.full_name || e.name || t("transactionModal.employeeFallback", { id: e.id }), value: e.id }))}
              />
              <input type="hidden" {...register("employeeId", { required: t("transactionModal.employeeRequired") })} />
              {errors.employeeId && <p className="text-red-500 text-xs mt-1">{errors.employeeId.message}</p>}
            </div>

            {/* Project + Month */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("transactionModal.project")}</label>
                <CustomDropdown
                  value={projectId}
                  onChange={(e) => setValue("projectId", e.target.value)}
                  placeholder={t("transactionModal.allCompanyWide")}
                  isSearchable
                  options={[{ label: t("transactionModal.allCompanyWide"), value: "" }, ...projects.map((p) => ({ label: p.project_name || p.name || t("projectFallback", { id: p.id }), value: p.id }))]}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("transactionModal.month")} <span className="text-red-500">*</span></label>
                <CustomMonthPicker
                  value={month}
                  onChange={(val) => setValue("month", val, { shouldValidate: true })}
                  className="h-[42px]"
                />
                <input type="hidden" {...register("month", R.month)} />
                {errors.month && <p className="text-red-500 text-xs mt-1">{errors.month.message}</p>}
              </div>
            </div>

            {/* Advance toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...register("isAdvance")} className="w-4 h-4 accent-cyan-600" />
              {t("transactionModal.advanceToggle")}
            </label>

            {/* Type + Amount */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("transactionModal.type")}</label>
                <CustomDropdown
                  value={isAdvance ? "DEDUCTION" : type}
                  onChange={(e) => setValue("type", e.target.value)}
                  options={[{ label: t("transactionModal.typeAdd"), value: "EARNING" }, { label: t("transactionModal.typeDeduct"), value: "DEDUCTION" }]}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("transactionModal.amount")} <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" {...register("amount", R.amount)} placeholder="0.00" className={inputCls(errors.amount)} />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
              </div>
            </div>

            {/* Optional component (ad-hoc month component) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("transactionModal.component")} <span className="text-gray-400 font-normal">{t("transactionModal.componentHint")}</span></label>
              <CustomDropdown
                value={componentId}
                onChange={(e) => {
                  setValue("componentId", e.target.value);
                  const c = components.find((x) => String(x.id) === String(e.target.value));
                  if (c) setValue("label", c.name);
                }}
                placeholder={t("transactionModal.componentNone")}
                options={[{ label: t("transactionModal.componentNone"), value: "" }, ...components.map((c) => ({ label: c.type ? t("transactionModal.componentOption", { name: c.name, type: t(`componentType.${c.type}`, { defaultValue: c.type }) }) : c.name, value: c.id }))]}
              />
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("transactionModal.label")} <span className="text-red-500">*</span></label>
              <input type="text" {...register("label", R.label)} placeholder={t("transactionModal.labelPlaceholder")} className={inputCls(errors.label)} />
              {errors.label && <p className="text-red-500 text-xs mt-1">{errors.label.message}</p>}
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900">{t("transactionModal.cancel")}</button>
          <button type="submit" form="create-transaction-form" disabled={submitting} className="px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 disabled:opacity-50">
            {submitting ? t("transactionModal.saving") : t("transactionModal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

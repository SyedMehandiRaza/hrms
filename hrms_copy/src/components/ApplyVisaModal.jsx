import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import CustomDropdown from "./CustomDropdown";
import { visaEmployees } from "../data/groupG";
import { useTranslation } from "react-i18next";

export default function ApplyVisaModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const { t } = useTranslation("visa");
  const [employees, setEmployees] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      employee_id: "",
      visa_type: "SINGLE_EXIT",
      requested_from: "",
      requested_to: "",
      final_exit_date: "",
      max_exits: "2",
      reason: "",
    },
  });

  const employeeIdValue = watch("employee_id");
  const visaTypeValue = watch("visa_type");
  const isFinalExit = visaTypeValue === "FINAL_EXIT";

  const fetchEmployees = (searchQuery = "") => {
    setEmployees(visaEmployees(searchQuery));
  };

  const handleSearchEmployees = (q) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const to = setTimeout(() => {
      fetchEmployees(q);
    }, 400);
    setSearchTimeout(to);
  };

  useEffect(() => {
    if (isOpen) {
      reset({
        employee_id: "",
        visa_type: "SINGLE_EXIT",
        requested_from: "",
        requested_to: "",
        final_exit_date: "",
        max_exits: "2",
        reason: "",
      });
      fetchEmployees();
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onFormSubmit = (data) => {
    const payload = {
      employee_id: Number(data.employee_id),
      visa_type: data.visa_type,
      // A final exit has a date, not a range — send one or the other, never both.
      ...(isFinalExit
        ? { final_exit_date: data.final_exit_date }
        : {
            ...(data.requested_from ? { requested_from: data.requested_from } : {}),
            ...(data.requested_to ? { requested_to: data.requested_to } : {}),
          }),
      ...(data.visa_type === "MULTIPLE_EXIT" && data.max_exits ? { max_exits: Number(data.max_exits) } : {}),
      ...(data.reason ? { reason: data.reason } : {}),
    };
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">{t("apply.employeeTitle")}</h3>
        <p className="text-sm text-gray-500 mt-1">{t("apply.employeeSubtitle")}</p>
        
        <form id="apply-visa-form" onSubmit={handleSubmit(onFormSubmit)} className="mt-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              {t("apply.employee")} <span className="text-red-500">*</span>
            </label>
            <CustomDropdown
              isSearchable
              {...register("employee_id", { required: t("validation.employeeRequired") })}
              value={employeeIdValue}
              error={!!errors.employee_id}
              onSearchChange={handleSearchEmployees}
              options={[
                { label: t("apply.selectEmployee"), value: "" },
                ...employees.map((emp) => ({
                  label: `${emp.full_name}${emp.country_emp_id ? ` (${emp.country_emp_id})` : ""}`,
                  value: emp.id,
                })),
              ]}
            />
            {errors.employee_id && <p className="text-red-500 text-xs mt-1">{errors.employee_id.message}</p>}
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              {t("apply.visaType")} <span className="text-red-500">*</span>
            </label>
            <CustomDropdown
              {...register("visa_type", { required: t("validation.visaTypeRequired") })}
              value={visaTypeValue}
              error={!!errors.visa_type}
              options={[
                { label: t("types.SINGLE_EXIT"), value: "SINGLE_EXIT" },
                { label: t("types.MULTIPLE_EXIT"), value: "MULTIPLE_EXIT" },
                { label: t("types.FINAL_EXIT"), value: "FINAL_EXIT" },
              ]}
            />
            {errors.visa_type && <p className="text-red-500 text-xs mt-1">{errors.visa_type.message}</p>}
          </div>
          
          {isFinalExit ? (
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                {t("apply.finalExitDate")} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register("final_exit_date", {
                  required: isFinalExit ? t("validation.finalExitDateRequired") : false,
                })}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 ${errors.final_exit_date ? 'border-red-500' : 'border-gray-200'}`}
              />
              {errors.final_exit_date && <p className="text-red-500 text-xs mt-1">{errors.final_exit_date.message}</p>}
              <p className="text-[11px] text-gray-400 mt-1">{t("apply.finalExitHint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("apply.from")} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  {...register("requested_from", { required: isFinalExit ? false : t("validation.fromRequired") })} 
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 ${errors.requested_from ? 'border-red-500' : 'border-gray-200'}`} 
                />
                {errors.requested_from && <p className="text-red-500 text-xs mt-1">{errors.requested_from.message}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("apply.to")} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  {...register("requested_to", { required: isFinalExit ? false : t("validation.toRequired") })} 
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 ${errors.requested_to ? 'border-red-500' : 'border-gray-200'}`} 
                />
                {errors.requested_to && <p className="text-red-500 text-xs mt-1">{errors.requested_to.message}</p>}
              </div>
            </div>
          )}
          
          {visaTypeValue === "MULTIPLE_EXIT" && (
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("apply.maxExits")}</label>
              <input 
                type="number" 
                min="2" 
                {...register("max_exits")} 
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" 
              />
            </div>
          )}
          
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("apply.reason")}</label>
            <textarea 
              {...register("reason")} 
              rows={3} 
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" 
            />
          </div>
        </form>
        
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">{t("actions.cancel")}</button>
          <button type="submit" form="apply-visa-form" disabled={isSubmitting} className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">{t("actions.apply")}</button>
        </div>
      </div>
    </div>
  );
}

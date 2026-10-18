import { useState } from "react";
import useFiscalYear from "../hooks/useFiscalYear";
import useYearLock from "../hooks/useYearLock";
import useFyResetState from "../hooks/useFyResetState";
import FieldError from "./FieldError";
import Loader from "./Loader";
import FyLoadError from "./fiscalYear/FyLoadError";
import { FiX, FiCalendar } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { PAYROLL_PROJECTS, createPayrollRun } from "../data/groupE";
import CustomDropdown from "./CustomDropdown";

const fmt = (d) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const RunPayrollModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t } = useTranslation("payroll");
  const running = false;

  const projects = PAYROLL_PROJECTS;
  const [projectId, setProjectId] = useState("");

  const fy = useFiscalYear();
  const lock = useYearLock();

  // The selected financial year's 12 months (FY order) → period_month / period_year.
  const monthOptions = fy.months.map((m) => ({
    value: m.value,
    label: `${t(`months.${m.month}`)} ${m.year}`,
    month: m.month,
    year: m.year,
  }));
  // Defaults to a sensible month of the FY and resets when the year changes.
  const [periodValue, setPeriodValue] = useFyResetState(fy.defaultMonth, fy.version);
  // Server refusal for the month (e.g. PeriodClosed on period_month) → under the picker.
  const [periodError, setPeriodError] = useFyResetState("", fy.version);

  // Pay-period boundaries derived from the selected month (the backend runs
  // monthly, so these are informational/read-only).
  const sel = monthOptions.find((o) => o.value === periodValue) || monthOptions[0] || null;
  const selYear = sel?.year;
  const selMonth = sel?.month;
  const startDate = selYear ? new Date(selYear, selMonth - 1, 1) : null;
  const endDate = selYear ? new Date(selYear, selMonth, 0) : null;

  if (!isOpen) return null;

  const handleRun = async () => {
    if (!sel || lock.locked) return;
    setPeriodError("");
    // Create + generate (static): the run gets a payslip per matching employee.
    const g = createPayrollRun({
      period_month: sel.month,
      period_year: sel.year,
      ...(projectId ? { project_id: Number(projectId) } : {}),
    });
    const runId = g.id;
    const count = g.employee_count ?? 0;
    const skipped = g.skipped_count ?? 0;
    toast.success(
      count === 1
        ? t(skipped ? "runToast.generatedOneSkipped" : "runToast.generatedOne", { count, skipped })
        : t(skipped ? "runToast.generatedManySkipped" : "runToast.generatedMany", { count, skipped }),
    );
    onClose?.();
    navigate(`/admin/payroll-overview/payroll-preview-monthly?runId=${runId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[440px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-[22px] font-bold text-gray-900">{t("runModal.title")}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t("runModal.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 transition-colors p-1 rounded-md"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
              {t("runModal.payrollMonth")}
            </label>
            {fy.failed ? (
              <FyLoadError className="!py-6" />
            ) : !fy.loaded ? (
              <Loader className="py-6" />
            ) : (
              <CustomDropdown
                value={periodValue}
                onChange={(e) => {
                  setPeriodValue(e.target.value);
                  setPeriodError("");
                }}
                options={monthOptions.map((m) => ({
                  label: m.label,
                  value: m.value
                }))}
              />
            )}
            <FieldError message={periodError} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-gray-600 mb-2">{t("runModal.startDate")}</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={startDate ? fmt(startDate) : ""}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-600 py-2.5 pl-3 pr-10 rounded-md focus:outline-none text-sm cursor-default"
                />
                <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-gray-600 mb-2">{t("runModal.endDate")}</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={endDate ? fmt(endDate) : ""}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-600 py-2.5 pl-3 pr-10 rounded-md focus:outline-none text-sm cursor-default"
                />
                <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-gray-600 mb-2">{t("runModal.project")}</label>
            <CustomDropdown
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={[
                { label: t("runModal.allProjects"), value: "" },
                ...projects.map((p) => ({
                  label: p.project_name || p.name || t("projectFallback", { id: p.id }),
                  value: p.id
                }))
              ]}
            />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            {t("runModal.scopeNote")}
          </p>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-[#F8F9FE] flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={running}
            className="py-2 px-6 bg-white border border-gray-300 text-gray-600 rounded-sm hover:bg-gray-50 transition-colors text-[11px] font-bold tracking-wide uppercase disabled:opacity-50"
          >
            {t("runModal.cancel")}
          </button>
          <button
            onClick={handleRun}
            disabled={running || lock.locked || !sel}
            title={lock.title}
            className="py-2 px-6 bg-cyan-600 text-white rounded-sm hover:bg-cyan-700 transition-colors text-[11px] font-bold tracking-wide uppercase disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {running ? t("runModal.running") : t("runModal.run")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunPayrollModal;

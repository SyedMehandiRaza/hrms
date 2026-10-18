import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import useFyResetState from "../../hooks/useFyResetState";
import {
  MdOutlineChevronRight,
  MdOutlineArrowForward,
  MdOutlineInfo,
  MdOutlinePeople,
  MdOutlineVerified,
  MdOutlineBarChart,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { PAYROLL_PROJECTS, createPayrollRun } from "../../data/groupE";
import CustomDropdown from "../../components/CustomDropdown";

const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2";


export default function RunPayroll() {
  const navigate = useNavigate();
  const { t } = useTranslation("payroll");

  const projects = PAYROLL_PROJECTS;
  const running = false;

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
  const [projectId, setProjectId] = useState(""); // "" = All Projects (company-wide)
  const [employeeType, setEmployeeType] = useState("ALL"); // ALL | FULL_TIME | CONTRACT

  const handleRun = async () => {
    const sel = monthOptions.find((o) => o.value === periodValue);
    if (!sel || lock.locked) return;
    // Create + generate (static): a payslip per matching employee.
    const g = createPayrollRun({
      period_month: sel.month,
      period_year: sel.year,
      ...(projectId ? { project_id: Number(projectId) } : {}),
      ...(employeeType === "ALL" ? {} : { employment_type: employeeType }),
    });
    const runId = g.id;
    const count = g.employee_count ?? 0;
    const skipped = g.skipped_count ?? 0;
    toast.success(
      count === 1
        ? t(skipped ? "runToast.generatedOneSkipped" : "runToast.generatedOne", { count, skipped })
        : t(skipped ? "runToast.generatedManySkipped" : "runToast.generatedMany", { count, skipped }),
    );
    navigate(`../payroll-preview-monthly?runId=${runId}`);
  };

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
        <Link
          to="/admin/payroll"
          className="text-gray-400 hover:text-cyan-600 transition-colors"
        >
          {t("review.breadcrumb.payroll")}
        </Link>
        <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
        <span className="text-cyan-600 font-semibold">
          {t("run.title")}
        </span>
      </div>

      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("run.title")}
        </h1>
        <p className="text-gray-500 mt-1.5 text-sm leading-relaxed max-w-xl">
          {t("run.subtitle")}
        </p>
      </div>

      {/* ── Main config card ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-6 md:px-8 space-y-6">
          {/* Row 1: Month + Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("run.selectMonth")}</label>
              <div className="relative">
                <CustomDropdown
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  options={monthOptions}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("run.selectProject")}</label>
              <div className="relative">
                <CustomDropdown
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  options={[
                    { label: t("run.projects.allProjects"), value: "" },
                    ...projects.map((p) => ({
                      label: p.project_name || p.name || t("projectFallback", { id: p.id }),
                      value: p.id,
                    })),
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Employee Type */}
          <div>
            <label className={labelCls}>{t("run.employeeType")}</label>
            <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden">
              {[
                { value: "ALL", label: t("run.type.allCompany") },
                { value: "FULL_TIME", label: t("run.type.fullTime") },
                { value: "CONTRACT", label: t("run.type.contract") },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setEmployeeType(type.value)}
                  className={`px-6 py-2.5 text-sm font-semibold transition-colors border-e border-gray-200 last:border-e-0 ${
                    employeeType === type.value
                      ? "bg-white text-cyan-600 shadow-sm"
                      : "bg-gray-50 text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Important Note banner */}
          <div className="flex items-start gap-3 border border-gray-200 rounded-xl px-4 py-4 bg-gray-50">
            <MdOutlineInfo className="text-cyan-600 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-0.5">
                {t("run.importantNote")}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t("run.ownEmployeesNote")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer: note + Run button ── */}
        <div className="border-t border-gray-200 px-6 md:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MdOutlinePeople className="text-gray-400 text-lg flex-shrink-0" />
            <span>
              {t("run.footerNote")}
            </span>
          </div>
          <button
            onClick={handleRun}
            disabled={running || lock.locked}
            title={lock.title}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-colors flex-shrink-0 ${
              running || lock.locked ? "bg-cyan-400 cursor-not-allowed" : "bg-cyan-600 hover:bg-cyan-700"
            }`}
          >
            {running ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {t("run.fetching")}
              </>
            ) : (
              <>
                {t("run.fetchEmployees")}
                <MdOutlineArrowForward className="text-lg rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Bottom Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="relative bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl p-6 overflow-hidden min-h-[180px] flex flex-col justify-between">
          <div className="absolute end-4 bottom-4 opacity-20">
            <MdOutlineBarChart className="text-[100px] text-white" />
          </div>
          <div>
            <p className="text-white text-lg font-bold mb-2">{t("run.insights.title")}</p>
            <p className="text-blue-200 text-sm leading-relaxed max-w-xs">
              {t("run.insights.body")}
            </p>
          </div>
          <button className="mt-4 self-start flex items-center gap-1.5 text-white text-sm font-semibold hover:text-blue-200 transition-colors">
            {t("run.insights.viewInsights")}
            <MdOutlineArrowForward className="text-base rtl:rotate-180" />
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[180px]">
          <div className="w-14 h-14 flex items-center justify-center">
            <MdOutlineVerified className="text-cyan-600 text-5xl" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">{t("run.systemReady.title")}</p>
            <p className="text-sm text-gray-400 mt-0.5">{t("run.systemReady.subtitle")}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {t("run.systemReady.live")}
          </span>
        </div>
      </div>
    </div>
  );
}

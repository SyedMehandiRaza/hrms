import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MdOutlineCalendarToday,
  MdOutlineHistory,
  MdOutlinePerson,
  MdOutlineReceiptLong,
  MdOutlineWarning,
  MdOutlineWork,
} from "react-icons/md";
import Ltr from "./Ltr";
import { useFormat } from "../hooks/useFormat";
import { formatPhone } from "../utils/phone";
import SalaryBreakdownModal from "./SalaryBreakdownModal";

const formatEmploymentType = (type, t) => {
  if (type === "FULL_TIME") return t("overview.fullTimeRegular");
  if (type === "CONTRACT") return t("overview.contract");
  return type || "—";
};

const formatMoney = (val, currency = "SAR") => {
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const projectInitial = (name) =>
  (name || "—").trim().charAt(0).toUpperCase() || "—";

// The saved salary (detail.salary) → the breakdown: earnings / deductions with PERCENTAGE rows
// resolved against Basic (D52), and the monthly gross / deductions / net.
const salaryBreakdown = (salary) => {
  if (!salary) return null;
  const basic = salary.components
    .filter((r) => String(r.component.code).toUpperCase() === "BASIC" && r.calculation_type === "FIXED")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const lines = salary.components.map((r) => ({
    name: r.component.name,
    code: r.component.code,
    type: r.component.type,
    amount: r.calculation_type === "PERCENTAGE" ? ((Number(r.amount) || 0) / 100) * basic : Number(r.amount) || 0,
  }));
  const earnings = lines.filter((l) => l.type !== "DEDUCTION");
  const deductions = lines.filter((l) => l.type === "DEDUCTION");
  const gross = earnings.reduce((s, l) => s + l.amount, 0);
  const ded = deductions.reduce((s, l) => s + l.amount, 0);
  return { currency: salary.currency || "SAR", current: { earnings, deductions, preview: { gross, deductions: ded, net: gross - ded } } };
};

// ── Overview Tab ──────────────────────────────────────────────────────────────
// `detail`: the employee from GET /employees/:id (null while loading).
function OverviewTab({ detail }) {
  const { t } = useTranslation("employees");
  const detailLoading = !detail;
  const employee = detail?.overview;

  const ACTIVITY = [
    {
      icon: MdOutlinePerson,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-500",
      title: t("overview.activity.profileUpdated"),
      sub: t("overview.activity.profileUpdatedSub"),
    },
    {
      icon: MdOutlineCalendarToday,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
      title: t("overview.activity.leaveApproved"),
      sub: t("overview.activity.leaveApprovedSub"),
    },
    {
      icon: MdOutlineWarning,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      title: t("overview.activity.documentExpiry"),
      sub: t("overview.activity.documentExpirySub"),
    },
  ];

  const fullName = employee?.name || (detailLoading ? t("detail.loading") : "—");
  const email = employee?.email || "—";
  const phone = employee?.phone ? formatPhone(employee.phone) : "—";
  const nationality = employee?.nationality?.name || "—";
  // Optional field — most employees have none, so fall back to the same dash.
  const accommodation = employee?.accommodation || "—";
  const iqamaNumber = employee?.country_emp_id || "—";

  const employmentType = formatEmploymentType(employee?.employment_type, t);
  const { fmtDate } = useFormat();
  const joinedOn = employee?.joining_date ? fmtDate(employee.joining_date) : "—";
  const roleName = employee?.role?.name || "—";

  const activeProjects = detail?.projects?.current || [];

  const salaryData = salaryBreakdown(detail?.salary);
  const currency = salaryData?.currency || "SAR";
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);

  const netMonthly = salaryData?.current?.preview?.net || 0;
  const baseSalary = salaryData?.current?.earnings?.find((e) => ["BASIC", "HOURLY"].includes(String(e.code).toUpperCase()))?.amount || salaryData?.current?.preview?.gross || 0;
  const extraAllowance = (salaryData?.current?.preview?.gross || 0) - baseSalary;
  const taxAndDeductions = salaryData?.current?.preview?.deductions || 0;

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* Left */}
      <div className="flex-1 space-y-5">
        {/* Personal Information */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <MdOutlinePerson className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">
              {t("overview.personalInformation")}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: t("overview.fullName"), value: fullName },
              { label: t("overview.email"), value: email, ltr: true },
              { label: t("overview.phoneNumber"), value: phone, ltr: true },
              { label: t("overview.nationality"), value: nationality },
              { label: t("overview.iqamaNumber"), value: iqamaNumber, ltr: true },
              {
                label: t("overview.accommodation"),
                value: accommodation,
              },
            ].map(({ label, value, ltr }) => (
              <div key={label}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {label}
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {ltr ? <Ltr>{value}</Ltr> : value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Employment Details */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <MdOutlineWork className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">
              {t("overview.employmentDetails")}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                {t("overview.employmentType")}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900">
                  {employmentType}
                </p>
                <span className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                {t("overview.currentRole")}
              </p>
              <p className="text-sm font-semibold text-gray-900">{roleName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                {t("overview.dateOfJoining")}
              </p>
              <p className="text-sm font-semibold text-gray-900">{joinedOn}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {t("overview.activeProjects")}{" "}
              {activeProjects.length > 0 && (
                <span className="text-cyan-600">({activeProjects.length})</span>
              )}
            </p>
            {activeProjects.length === 0 ? (
              <div className="w-full border border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400">
                {t("overview.noActiveProjects")}
              </div>
            ) : (
              <div className="space-y-2">
                {activeProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3"
                  >
                    <div className="w-9 h-9 bg-cyan-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {projectInitial(proj.name)}
                    </div>
                    <div className="flex-1 text-start">
                      <p className="text-sm font-bold text-gray-900">
                        {proj.name}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {proj.code || "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
        {/* Compensation Summary */}
        <div className="bg-gray-900 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute bottom-2 end-3 opacity-10 text-[100px] leading-none select-none pointer-events-none text-white">
            ₭
          </div>
          <div className="flex items-center gap-2 mb-4">
            <MdOutlineReceiptLong className="text-cyan-400 text-xl" />
            <h3 className="text-base font-bold text-white">
              {t("overview.compensationSummary")}
            </h3>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {t("overview.netMonthlyIncome")}
          </p>
          <div className="flex items-end justify-between mb-4">
            <p className="text-3xl font-bold text-white">
              <Ltr>{formatMoney(netMonthly, currency)}</Ltr>
            </p>
            <span className="text-[10px] font-bold text-green-400 bg-green-900/40 border border-green-700 px-2 py-0.5 rounded-full">
              {t("overview.paid")}
            </span>
          </div>
          <div className="space-y-2 mb-4">
            {[
              {
                label: t("overview.baseSalary"),
                value: formatMoney(baseSalary, currency),
                color: "text-gray-300",
              },
              {
                label: t("overview.totalAllowances"),
                value: `+${formatMoney(extraAllowance, currency)}`,
                color: "text-green-400",
              },
              {
                label: t("overview.taxDeductions"),
                value: `-${formatMoney(taxAndDeductions, currency)}`,
                color: "text-red-400",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{label}</span>
                <span className={`text-xs font-bold ${color}`}>
                  <Ltr>{value}</Ltr>
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setIsSalaryModalOpen(true)}
            className="cursor-pointer w-full border border-gray-600 text-gray-300 hover:bg-gray-700 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
          >
            {t("overview.viewDetailedBreakdown")}
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <MdOutlineHistory className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">
              {t("overview.recentActivity")}
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {ACTIVITY.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 px-5 py-4"
                >
                  <div
                    className={`w-8 h-8 ${item.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`${item.iconColor} text-base`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {item.title}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                      {item.sub}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-100 px-5 py-3">
            <button className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-700 uppercase tracking-wider transition-colors py-1">
              {t("overview.viewAllLogs")}
            </button>
          </div>
        </div>
      </div>

      <SalaryBreakdownModal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        salaryData={salaryData}
      />
    </div>
  );
}

export default OverviewTab;

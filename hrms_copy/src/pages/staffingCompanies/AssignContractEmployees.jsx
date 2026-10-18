import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdOutlineChevronRight,
  MdOutlinePersonAdd,
  MdOutlineSearch,
  MdOutlineBusiness,
  MdOutlineListAlt,
  MdOutlineCheckCircle,
  MdOutlineTrendingUp,
  MdOutlineError,
} from "react-icons/md";
import { useFormat } from "../../hooks/useFormat";
import Ltr from "../../components/Ltr";
import CustomDropdown from "../../components/CustomDropdown";

// ── Data ──────────────────────────────────────────────────────────────────────
const EMPLOYEES = [
  "Robert Jenkins",
  "Karen Lee",
  "Sarah Martinez",
  "David Kim",
  "Alice Wong",
  "Tom Briggs",
];
const VENDORS = [
  "Nexus Workforce",
  "Prime Resource",
  "Global Staffing",
  "Vanguard Resource Group",
  "Prime Staffing Solutions",
];
const PROJECTS = [
  "Apollo Cloud Infrastructure",
  "Mobile API",
  "Cloud Security",
  "Project Alpha",
  "Data Hub Expansion",
];

const COMPLIANCE = [
  {
    labelKey: "assign.compliance.msaSigned",
    statusKey: "assign.compliance.msaStatus",
    style: "text-green-700 bg-green-50 border-green-200",
  },
  {
    labelKey: "assign.compliance.insurance",
    statusKey: "assign.compliance.insuranceStatus",
    style: "text-blue-700 bg-blue-50 border-blue-200",
  },
  {
    labelKey: "assign.compliance.tax",
    statusKey: "assign.compliance.taxStatus",
    style: "text-amber-700 bg-amber-50 border-amber-200",
  },
];

const HISTORY = [
  {
    initials: "RJ",
    color: "bg-cyan-500",
    name: "Robert Jenkins",
    company: "Nexus Workforce",
    project: "Mobile API",
    date: "2023-10-12",
    statusKey: "assign.history.status.onboarded",
    statusStyle: "text-green-700 bg-green-50 border-green-200",
  },
  {
    initials: "KL",
    color: "bg-indigo-400",
    name: "Karen Lee",
    company: "Prime Resource",
    project: "Cloud Security",
    date: "2023-10-05",
    statusKey: "assign.history.status.pendingDocs",
    statusStyle: "text-blue-700 bg-blue-50 border-blue-200",
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const selectCls = (err) =>
  `${inputBase} appearance-none pr-9 cursor-pointer ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls =
  "block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0 text-sm" />
      {error.message}
    </p>
  ) : null;

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AssignContractEmployees({ onBack }) {
  const { t } = useTranslation("staffing");
  const { fmtDate } = useFormat();
  const [confirmed, setConfirmed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      employee: "",
      vendor: "",
      project: "",
      role: "",
      billingRate: "",
    },
  });

  const onSubmit = (data) => {
    console.log("Assignment confirmed:", data);
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <MdOutlineCheckCircle className="text-green-500 text-4xl" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {t("assign.success.title")}
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          {t("assign.success.message")}
        </p>
        <button
          onClick={() => {
            setConfirmed(false);
            onBack?.();
          }}
          className="mt-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {t("assign.success.back")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 px-6">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
          <Link
            to="/admin/staffing-companies"
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("assign.breadcrumbContracts")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">
            {t("assign.breadcrumbFlow")}
          </span>
        </div>

        {/* ── Page Header ── */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("assign.title")}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {t("assign.subtitle")}
          </p>
        </div>

        {/* ── Two-column Layout ── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* ── Left: Assignment Form ── */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
            {/* Card Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MdOutlinePersonAdd className="text-indigo-500 text-xl" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {t("assign.assignmentDetails")}
              </h3>
            </div>

            <div className="space-y-5">
              {/* Select Employee */}
              <div>
                <label className={labelCls}>{t("assign.fields.selectEmployee")}</label>
                <div className="relative">
                  <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
                  <CustomDropdown
                    {...register("employee", {
                      required: t("assign.validation.employeeRequired"),
                    })}
                    className={selectCls(errors.employee) + " ps-10"}
                    options={[
                      { label: t("assign.fields.selectEmployeePlaceholder"), value: "" },
                      ...EMPLOYEES.map((e) => ({ label: e, value: e }))
                    ]}
                  />
                </div>
                <FieldErr error={errors.employee} />
              </div>

              {/* Select Staffing Company */}
              <div>
                <label className={labelCls}>{t("assign.fields.selectCompany")}</label>
                <div className="relative">
                  <MdOutlineBusiness className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
                  <CustomDropdown
                    {...register("vendor", {
                      required: t("assign.validation.companyRequired"),
                    })}
                    className={selectCls(errors.vendor) + " ps-10"}
                    options={[
                      { label: t("assign.fields.selectCompanyPlaceholder"), value: "" },
                      ...VENDORS.map((v) => ({ label: v, value: v }))
                    ]}
                  />
                </div>
                <FieldErr error={errors.vendor} />
              </div>

              {/* Assign to Project */}
              <div>
                <label className={labelCls}>{t("assign.fields.assignProject")}</label>
                <div className="relative">
                  <MdOutlineListAlt className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
                  <CustomDropdown
                    {...register("project", {
                      required: t("assign.validation.projectRequired"),
                    })}
                    className={selectCls(errors.project) + " ps-10"}
                    options={[
                      { label: t("assign.fields.assignProjectPlaceholder"), value: "" },
                      ...PROJECTS.map((p) => ({ label: p, value: p }))
                    ]}
                  />
                </div>
                <FieldErr error={errors.project} />
              </div>

              {/* Designated Role + Billing Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t("assign.fields.role")}</label>
                  <input
                    {...register("role", {
                      required: t("assign.validation.roleRequired"),
                      minLength: { value: 3, message: t("assign.validation.tooShort") },
                    })}
                    placeholder={t("assign.fields.rolePlaceholder")}
                    className={inputCls(errors.role)}
                  />
                  <FieldErr error={errors.role} />
                </div>
                <div>
                  <label className={labelCls}>{t("assign.fields.billingRate")}</label>
                  <div className="relative">
                    <span className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                      $
                    </span>
                    <input
                      {...register("billingRate", {
                        required: t("assign.validation.billingRateRequired"),
                        min: { value: 1, message: t("assign.validation.greaterThanZero") },
                        pattern: {
                          value: /^\d+(\.\d{1,2})?$/,
                          message: t("assign.validation.validRate"),
                        },
                      })}
                      type="number"
                      placeholder={t("assign.fields.billingRatePlaceholder")}
                      className={inputCls(errors.billingRate) + " ps-8"}
                    />
                  </div>
                  <FieldErr error={errors.billingRate} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t("assign.buttons.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {t("assign.buttons.confirm")}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
            {/* Contractor Role Summary */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-0.5">
                {t("assign.summary.title")}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {t("assign.summary.subtitle")}
              </p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("assign.summary.utilizationRate")}
                  </p>
                  <p className="text-sm font-bold text-cyan-600">
                    <Ltr>100%</Ltr>
                  </p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-cyan-600 rounded-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t("assign.summary.weeklyCap")}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {t("assign.summary.weeklyCapValue")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t("assign.summary.duration")}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {t("assign.summary.durationValue")}
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Compliance Status */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <MdOutlineCheckCircle className="text-cyan-600 text-xl" />
                <h3 className="text-sm font-bold text-gray-900">
                  {t("assign.compliance.title")}
                </h3>
              </div>
              <div className="space-y-3">
                {COMPLIANCE.map(({ labelKey, statusKey, style }) => (
                  <div
                    key={labelKey}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-gray-600">{t(labelKey)}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${style}`}
                    >
                      {t(statusKey)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Tracking */}
            <div className="bg-gray-900 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute bottom-2 end-3 opacity-10 text-[80px] leading-none select-none pointer-events-none">
                <MdOutlineTrendingUp className="text-white" />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("assign.budget.title")}
              </p>
              <p className="text-3xl font-bold text-white mb-1">
                <Ltr>$42,500.00</Ltr>
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {t("assign.budget.remaining")}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                <MdOutlineTrendingUp className="text-base" />{" "}
                {t("assign.budget.withinVariance")}
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Assignment History ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">
              {t("assign.history.title")}
            </h3>
            <button className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
              {t("assign.history.viewAll")}
            </button>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    t("assign.history.table.sn"),
                    t("assign.history.table.contractor"),
                    t("assign.history.table.company"),
                    t("assign.history.table.project"),
                    t("assign.history.table.startDate"),
                    t("assign.history.table.status"),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-start px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {HISTORY.map((row, index) => (
                  <tr
                    key={row.name}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {index + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
                        >
                          {row.initials}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {row.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {row.company}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {row.project}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      <Ltr>{fmtDate(row.date)}</Ltr>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold border ${row.statusStyle}`}
                      >
                        {t(row.statusKey)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {HISTORY.map((row) => (
              <div key={row.name} className="flex items-start gap-3 px-4 py-4">
                <div
                  className={`w-9 h-9 rounded-full ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
                >
                  {row.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {row.name}
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${row.statusStyle}`}
                    >
                      {t(row.statusKey)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                    <span>{row.company}</span>
                    <span>{row.project}</span>
                    <span>
                      <Ltr>{fmtDate(row.date)}</Ltr>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

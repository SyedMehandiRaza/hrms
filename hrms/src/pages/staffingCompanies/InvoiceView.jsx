import { useState } from "react";
import {
  MdOutlineDownload,
  MdOutlineEmail,
  MdOutlineCheckCircle,
  MdOutlineLocationOn,
  MdOutlineAccessTime,
  MdOutlinePeople,
  MdOutlineSearch,
  MdOutlineFilterList,
  MdOutlineSecurity,
  MdOutlineLock,
  MdOutlineSync,
  MdOutlineChevronRight,
} from "react-icons/md";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Ltr from "../../components/Ltr";

// ── Data ──────────────────────────────────────────────────────────────────────
const EMPLOYEES = [
  {
    initials: "JD",
    color: "bg-blue-100",
    textColor: "text-blue-600",
    name: "Johnathan Doe",
    roleKey: "invoice.roles.seniorLogisticsLead",
    deptKey: "invoice.departments.operations",
    hours: 168.0,
    rate: 45.0,
  },
  {
    initials: "SM",
    color: "bg-green-100",
    textColor: "text-green-600",
    name: "Sarah Martinez",
    roleKey: "invoice.roles.inventorySpecialist",
    deptKey: "invoice.departments.warehouse",
    hours: 160.0,
    rate: 32.5,
  },
  {
    initials: "RK",
    color: "bg-purple-100",
    textColor: "text-purple-600",
    name: "Robert King",
    roleKey: "invoice.roles.fleetManager",
    deptKey: "invoice.departments.distribution",
    hours: 174.5,
    rate: 48.0,
  },
  {
    initials: "AW",
    color: "bg-amber-100",
    textColor: "text-amber-600",
    name: "Alice Wong",
    roleKey: "invoice.roles.supplyChainAnalyst",
    deptKey: "invoice.departments.operations",
    hours: 160.0,
    rate: 40.0,
  },
];

const TAX_RATE = 0.05;
const SERVICE_FEE = 0.08;
const SUBTOTAL = 214845.2;
const SERVICE_AMT = 17187.62;
const TAX_AMT = 11601.64;
const NET_PAYABLE = 243634.46;

const fmt = (n) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ initials, color, textColor }) => (
  <div
    className={`w-9 h-9 rounded-lg ${color} ${textColor} text-xs font-bold flex items-center justify-center flex-shrink-0`}
  >
    {initials}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvoiceView() {
  const { t } = useTranslation("staffing");
  const [search, setSearch] = useState("");

  const filtered = EMPLOYEES.filter(
    (e) =>
      search === "" ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      t(e.deptKey).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="space-y-6">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <Link
            to="/admin/staffing-companies"
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("invoice.breadcrumbManagement")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-gray-400">{t("invoice.breadcrumbCompany")}</span>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <Link to="/staffing-companies/company-detail/1">
            <span className="text-gray-400 hover:text-cyan-600">
              <Ltr>1</Ltr>
            </span>
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">
            {t("invoice.breadcrumbCurrent")}
          </span>
        </div>
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("invoice.title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("invoice.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              <MdOutlineDownload className="text-base" /> {t("invoice.downloadPdf")}
            </button>
            <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              <MdOutlineEmail className="text-base" /> {t("invoice.sendToCompany")}
            </button>
            <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              <MdOutlineCheckCircle className="text-lg" /> {t("invoice.generateInvoice")}
            </button>
          </div>
        </div>

        {/* ── Company Info + Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Company Card */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Company Icon */}
                <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MdOutlinePeople className="text-gray-400 text-2xl" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-base font-bold text-gray-900">
                      {t("invoice.companyName")}
                    </h2>
                    <span className="text-[11px] font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
                      {t("invoice.activeProject")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    {t("invoice.contractId")}{" "}
                    <Ltr>#VND-2024-00892</Ltr>
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MdOutlineLocationOn className="text-gray-400" />{" "}
                      {t("invoice.city")}
                    </span>
                    <span className="flex items-center gap-1">
                      <MdOutlineAccessTime className="text-gray-400" />{" "}
                      {t("invoice.netTerms")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-gray-400 mb-1">
                  {t("invoice.billingPeriod")}
                </p>
                <p className="text-base font-bold text-gray-900">
                  {t("invoice.billingPeriodValue")}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Column */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-4">
            {/* Total Employees */}
            <div className="flex-1 bg-cyan-600 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-4 end-4 opacity-20">
                <MdOutlinePeople className="text-5xl text-white" />
              </div>
              <p className="text-xs font-semibold text-cyan-200 mb-1">
                {t("invoice.totalEmployees")}
              </p>
              <p className="text-4xl font-bold text-white mb-1">
                <Ltr>42</Ltr>
              </p>
              <p className="text-xs text-cyan-200">{t("invoice.employeesDelta")}</p>
            </div>

            {/* Total Hours */}
            <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium">
                  {t("invoice.totalHoursWorked")}
                </p>
                <MdOutlineAccessTime className="text-gray-300 text-xl" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-3">
                <Ltr>6,720.50</Ltr>{" "}
                <span className="text-sm font-normal text-gray-400">
                  {t("invoice.hrs")}
                </span>
              </p>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-cyan-600 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Employee Labor Breakdown ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">
              {t("invoice.laborBreakdown")}
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("invoice.searchPlaceholder")}
                  className="w-full sm:w-48 ps-9 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              </div>
              <button className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors flex-shrink-0">
                <MdOutlineFilterList />
              </button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    { label: t("invoice.table.sn"), align: "text-start" },
                    { label: t("invoice.table.employeeDetails"), align: "text-start" },
                    { label: t("invoice.table.department"), align: "text-start" },
                    { label: t("invoice.table.hours"), align: "text-end" },
                    { label: t("invoice.table.rate"), align: "text-end" },
                    { label: t("invoice.table.tax"), align: "text-end" },
                    { label: t("invoice.table.amount"), align: "text-end" },
                  ].map(({ label, align }) => (
                    <th
                      key={label}
                      className={`px-5 py-3 text-xs font-semibold text-cyan-600 ${align}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((emp, index) => {
                  const tax = emp.hours * emp.rate * TAX_RATE;
                  const amount = emp.hours * emp.rate + tax;
                  return (
                    <tr
                      key={emp.name}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar {...emp} />
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {emp.name}
                            </p>
                            <p className="text-xs text-gray-400">{t(emp.roleKey)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {t(emp.deptKey)}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 text-end">
                        <Ltr>{fmt(emp.hours)}</Ltr>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400 text-end">
                        <Ltr>{fmt(emp.rate)}</Ltr>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400 text-end">
                        <Ltr>{fmt(tax)}</Ltr>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900 text-end">
                        <Ltr>{fmt(amount)}</Ltr>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((emp) => {
              const tax = emp.hours * emp.rate * TAX_RATE;
              const amount = emp.hours * emp.rate + tax;
              return (
                <div key={emp.name} className="px-4 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar {...emp} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">
                        {emp.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t(emp.roleKey)} · {t(emp.deptKey)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                      <Ltr>${fmt(amount)}</Ltr>
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      [t("invoice.mobile.hours"), fmt(emp.hours)],
                      [t("invoice.mobile.rate"), `$${fmt(emp.rate)}`],
                      [t("invoice.mobile.tax"), `$${fmt(tax)}`],
                    ].map(([label, val]) => (
                      <div
                        key={label}
                        className="bg-gray-50 rounded-lg px-3 py-2 text-center"
                      >
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                          {label}
                        </p>
                        <p className="text-sm font-semibold text-gray-600">
                          <Ltr>{val}</Ltr>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional rows notice */}
          <div className="px-5 py-4 text-center border-t border-gray-50">
            <p className="text-sm text-gray-400">
              {t("invoice.additionalRows")}
            </p>
          </div>
        </div>

        {/* ── Invoice Summary ── */}
        <div className="flex justify-end">
          <div className="w-full sm:w-auto sm:min-w-[380px] bg-white border border-gray-200 rounded-xl p-6 relative overflow-hidden">
            {/* Decorative watermark */}
            <div className="absolute top-4 end-4 opacity-5 text-[80px] leading-none select-none pointer-events-none">
              <MdOutlineCheckCircle />
            </div>

            <div className="space-y-3 mb-5">
              {[
                {
                  label: t("invoice.summary.subtotal"),
                  value: SUBTOTAL,
                  color: "text-gray-700",
                },
                {
                  label: t("invoice.summary.serviceFee"),
                  value: SERVICE_AMT,
                  color: "text-gray-700",
                },
                {
                  label: t("invoice.summary.taxes"),
                  value: TAX_AMT,
                  color: "text-gray-700",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-8"
                >
                  <span className="text-sm text-gray-400">{label}</span>
                  <span className={`text-sm font-semibold ${color}`}>
                    <Ltr>${fmt(value)}</Ltr>
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mb-2">
                {t("invoice.summary.netPayable")}
              </p>
              <div className="flex items-end justify-between gap-4">
                <p className="text-4xl font-bold text-gray-900">
                  <Ltr>${fmt(NET_PAYABLE)}</Ltr>
                </p>
                <span className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-500 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0 mb-1">
                  <MdOutlineAccessTime className="text-sm" /> {t("invoice.summary.due")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
            <span className="flex items-center gap-1.5">
              <MdOutlineSecurity className="text-gray-400" /> {t("invoice.footer.gdpr")}
            </span>
            <span className="flex items-center gap-1.5">
              <MdOutlineLock className="text-gray-400" /> {t("invoice.footer.encryption")}
            </span>
            <span className="flex items-center gap-1.5">
              <MdOutlineSync className="text-gray-400" /> {t("invoice.footer.autoSync")}
            </span>
          </div>
          <p className="text-center sm:text-right">
            {t("invoice.footer.copyright")}
          </p>
        </div>
      </div>
    </>
  );
}

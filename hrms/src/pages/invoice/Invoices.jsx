import { useMemo, useState } from "react";
import Pagination from "../../components/Pagination";
import {
  MdOutlineTrendingUp,
  MdOutlineWarning,
  MdOutlineCheckCircle,
  MdOutlineFilterList,
  MdOutlineDownload,
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
  MdOutlineAutoAwesome,
  MdHelpOutline,
  MdOutlineCalendarToday,
  MdOutlineArrowUpward,
  MdOutlineArrowDownward,
} from "react-icons/md";

import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Ltr from "../../components/Ltr";
import CustomDropdown from "../../components/CustomDropdown";

// ── Data ──────────────────────────────────────────────────────────────────────
const ALL_INVOICES = [
  {
    id: "INV-2023-0842",
    initials: "AG",
    color: "bg-blue-400",
    company: "Apex Global Talent",
    project: "Enterprise CRM Migration",
    amount: "$12,450.00",
    date: "Oct 12, 2023",
    status: "Overdue",
  },
  {
    id: "INV-2023-0841",
    initials: "VW",
    color: "bg-purple-400",
    company: "Vertex Workforce",
    project: "Cloud Architecture Audit",
    amount: "$8,200.00",
    date: "Oct 11, 2023",
    status: "Pending",
  },
  {
    id: "INV-2023-0840",
    initials: "NS",
    color: "bg-amber-400",
    company: "Nexus Staffing",
    project: "Frontend Revamp Project",
    amount: "$15,000.00",
    date: "Oct 10, 2023",
    status: "Paid",
  },
  {
    id: "INV-2023-0839",
    initials: "AG",
    color: "bg-blue-400",
    company: "Apex Global Talent",
    project: "QA Automation Phase 2",
    amount: "$6,750.00",
    date: "Oct 09, 2023",
    status: "Paid",
  },
  {
    id: "INV-2023-0838",
    initials: "BT",
    color: "bg-gray-500",
    company: "Bright Tech Sourcing",
    project: "Mobile App Development",
    amount: "$21,300.00",
    date: "Oct 08, 2023",
    status: "Pending",
  },
  {
    id: "INV-2023-0837",
    initials: "NS",
    color: "bg-amber-400",
    company: "Nexus Staffing",
    project: "Data Pipeline Setup",
    amount: "$9,800.00",
    date: "Oct 07, 2023",
    status: "Paid",
  },
  {
    id: "INV-2023-0836",
    initials: "VW",
    color: "bg-purple-400",
    company: "Vertex Workforce",
    project: "Security Audit Q4",
    amount: "$4,500.00",
    date: "Oct 06, 2023",
    status: "Overdue",
  },
  {
    id: "INV-2023-0835",
    initials: "BT",
    color: "bg-gray-500",
    company: "Bright Tech Sourcing",
    project: "AI Feature Integration",
    amount: "$18,200.00",
    date: "Oct 05, 2023",
    status: "Paid",
  },
  {
    id: "INV-2023-0834",
    initials: "AG",
    color: "bg-blue-400",
    company: "Apex Global Talent",
    project: "ERP Migration Phase 3",
    amount: "$11,000.00",
    date: "Oct 04, 2023",
    status: "Pending",
  },
];

const COMPANIES = [
  "All Companies",
  "Apex Global Talent",
  "Vertex Workforce",
  "Nexus Staffing",
  "Bright Tech Sourcing",
];

const PAGE_SIZE = 5;

const STATUS_STYLES = {
  Overdue: "text-red-600",
  Pending: "text-amber-600",
  Paid: "text-green-600",
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Invoices() {
  const { t } = useTranslation("invoices");
  const navigate = useNavigate();

  const [company, setCompany] = useState("All Companies");
  const [statusTab, setStatusTab] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    return ALL_INVOICES.filter((inv) => {
      const matchCompany =
        company === "All Companies" || inv.company === company;

      const matchStatus = statusTab === "All" || inv.status === statusTab;

      let matchDate = true;
      if (dateRangeFilter.start || dateRangeFilter.end) {
        const invDate = new Date(inv.date);
        if (dateRangeFilter.start) {
          matchDate = matchDate && invDate >= new Date(dateRangeFilter.start);
        }
        if (dateRangeFilter.end) {
          const endDate = new Date(dateRangeFilter.end);
          endDate.setDate(endDate.getDate() + 1);
          matchDate = matchDate && invDate < endDate;
        }
      }

      return matchCompany && matchStatus && matchDate;
    });
  }, [company, statusTab, dateRangeFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sortDir === "desc" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id),
    );
  }, [filtered, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const onTabChange = (tab) => {
    setStatusTab(tab);
    setPage(1);
  };

  return (
    
      <div className="space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            {t("list.title")}
          </h1>

          <p className="text-gray-400 mt-1 text-xs sm:text-sm leading-relaxed max-w-3xl">
            {t("list.subtitle")}
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              tag: t("list.stats.totalRevenue"),
              tagColor: "text-gray-400",
              value: "$428,500.00",
              valueColor: "text-gray-900",
              sub: (
                <span className="flex items-center gap-1 text-xs text-green-500 font-semibold">
                  <MdOutlineTrendingUp />
                  12.5% from last month
                </span>
              ),
            },

            {
              tag: t("list.stats.outstanding"),
              tagColor: "text-gray-400",
              value: "$84,200.00",
              valueColor: "text-gray-900",
              sub: (
                <span className="text-xs text-gray-400">
                  24 invoices pending
                </span>
              ),
            },

            {
              tag: t("list.stats.overdue"),
              tagColor: "text-gray-400",
              value: "$12,450.00",
              valueColor: "text-red-500",
              sub: (
                <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                  <MdOutlineWarning className="text-sm" />3 high priority
                </span>
              ),
            },

            {
              tag: t("list.stats.paidMtd"),
              tagColor: "text-cyan-600",
              value: "$156,000.00",
              valueColor: "text-gray-900",
              sub: (
                <span className="flex items-center gap-1 text-xs text-cyan-600 font-semibold">
                  <MdOutlineCheckCircle className="text-sm" />
                  89% collection rate
                </span>
              ),
            },
          ].map((card) => (
            <div
              key={card.tag}
              className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5"
            >
              <p
                className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${card.tagColor}`}
              >
                {card.tag}
              </p>

              <p
                className={`text-xl sm:text-2xl font-bold mb-1.5 ${card.valueColor}`}
              >
                <Ltr>{card.value}</Ltr>
              </p>

              {card.sub}
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex flex-col xl:flex-row xl:items-end gap-4">
            {/* Company */}
            <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[200px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("list.filters.staffingCompany")}
              </label>

              <div className="relative">
                <CustomDropdown
                  value={company}
                  onChange={(e) => onFilter(setCompany)({ target: { value: e.target.value } })}
                  options={COMPANIES.map((c) => ({
                    label: c === "All Companies" ? t("list.companies.all") : c,
                    value: c
                  }))}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[150px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("list.filters.status")}
              </label>

              <div className="relative">
                <CustomDropdown
                  value={statusTab}
                  onChange={(e) => onTabChange(e.target.value)}
                  options={[
                    { value: "All", label: t("list.statusTabs.all") },
                    { value: "Paid", label: t("list.statusTabs.paid") },
                    { value: "Pending", label: t("list.statusTabs.pending") },
                    { value: "Overdue", label: t("list.statusTabs.overdue") },
                  ]}
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-1 w-full xl:flex-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("list.filters.dateRange")}
              </label>
              <div className="flex items-center gap-2 h-[42px]">
                <div className="relative flex-1 h-full">
                  <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={dateRangeFilter.start}
                    onChange={(e) => { setDateRangeFilter({ ...dateRangeFilter, start: e.target.value }); setPage(1); }}
                    className="w-full h-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-[#17a2b8]"
                  />
                </div>
                <span className="text-gray-400 text-sm font-medium">to</span>
                <div className="relative flex-1 h-full">
                  <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={dateRangeFilter.end}
                    onChange={(e) => { setDateRangeFilter({ ...dateRangeFilter, end: e.target.value }); setPage(1); }}
                    className="w-full h-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-[#17a2b8]"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
              <button
                onClick={() => {
                  setCompany("All Companies");
                  setStatusTab("All");
                  setDateRangeFilter({ start: "", end: "" });
                  setPage(1);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 h-[42px] px-6 rounded-lg text-xs sm:text-sm font-medium transition-colors"
              >
                <MdOutlineFilterList />
                {t("list.filters.clearFilters")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="sticky top-0 bg-white z-10 border-b border-gray-100">
                <tr>
                  <th className="text-start px-3 sm:px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("list.table.sn")}
                  </th>
                  <th className="text-start px-3 sm:px-5 py-3">
                    <button
                      onClick={() =>
                        setSortDir((d) => (d === "desc" ? "asc" : "desc"))
                      }
                      className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-700"
                    >
                      {t("list.table.invoiceId")}
                      {sortDir === "desc" ? (
                        <MdOutlineArrowDownward className="text-sm" />
                      ) : (
                        <MdOutlineArrowUpward className="text-sm" />
                      )}
                    </button>
                  </th>

                  <th className="text-start px-3 sm:px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("list.table.staffingCompany")}
                  </th>

                  <th className="hidden lg:table-cell text-start px-3 sm:px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("list.table.project")}
                  </th>

                  <th className="text-start px-3 sm:px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("list.table.totalAmount")}
                  </th>

                  <th className="hidden md:table-cell text-start px-3 sm:px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("list.table.issueDate")}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-sm text-gray-400"
                    >
                      {t("list.empty")}
                    </td>
                  </tr>
                ) : (
                  paginated.map((inv, index) => (
                    <tr
                      key={inv.id}
                      onClick={() => navigate("/admin/invoices/invoice-detail")}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-3 sm:px-5 py-3 sm:py-4">
                        <span
                          className={`text-xs sm:text-sm font-semibold ${STATUS_STYLES[inv.status]}`}
                        >
                          <Ltr>{inv.id}</Ltr>
                        </span>
                      </td>

                      <td className="px-3 sm:px-5 py-3 sm:py-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-md ${inv.color} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}
                          >
                            {inv.initials}
                          </div>

                          <span className="truncate max-w-[180px] text-xs sm:text-sm text-gray-700 font-medium">
                            {inv.company}
                          </span>
                        </div>
                      </td>

                      <td className="hidden lg:table-cell px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">
                        {inv.project}
                      </td>

                      <td className="px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-bold text-gray-900">
                        <Ltr>{inv.amount}</Ltr>
                      </td>

                      <td className="hidden md:table-cell px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                        <Ltr>{inv.date}</Ltr>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("list.empty")}
              </div>
            ) : (
              paginated.map((inv) => (
                <Link
                  key={inv.id}
                  to="/invoices/invoice-detail"
                  className="block px-4 py-4 space-y-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`text-sm font-semibold ${STATUS_STYLES[inv.status]}`}
                    >
                      <Ltr>{inv.id}</Ltr>
                    </span>

                    <span className="text-sm font-bold text-gray-900">
                      <Ltr>{inv.amount}</Ltr>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-md ${inv.color} text-white text-[10px] font-bold flex items-center justify-center`}
                    >
                      {inv.initials}
                    </div>

                    <span className="text-sm font-medium text-gray-700 truncate">
                      {inv.company}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">{inv.project}</p>

                    <p className="text-xs text-gray-400"><Ltr>{inv.date}</Ltr></p>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            limit={PAGE_SIZE}
            onPage={setPage}
            label={t("paginationLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-5 py-4 border-t border-gray-100"
          />
        </div>

        {/* ── Bottom Cards ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Auto Invoice */}
          <div className="bg-gray-900 rounded-xl p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl" />

            <div className="relative z-10">
              <h3 className="text-lg font-bold text-white mb-2">
                {t("list.autoInvoice.title")}
              </h3>

              <p className="text-sm text-gray-300 leading-relaxed mb-5">
                {t("list.autoInvoice.description")}
              </p>

              <button className="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors">
                {t("list.autoInvoice.enable")}
                <MdOutlineAutoAwesome className="text-cyan-600" />
              </button>
            </div>
          </div>

          {/* Help */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center">
              <MdHelpOutline className="text-cyan-500 text-3xl" />
            </div>

            <div>
              <p className="text-base font-bold text-gray-900 mb-1">
                {t("list.help.title")}
              </p>

              <p className="text-sm text-gray-400 leading-relaxed">
                {t("list.help.description")}
              </p>
            </div>

            <button className="w-full border border-gray-200 text-gray-700 hover:bg-gray-50 py-2.5 rounded-lg text-sm font-semibold transition-colors">
              {t("list.help.viewSupport")}
            </button>
          </div>
        </div>
      </div>
  
  );
}

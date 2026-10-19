import { useState } from "react";
import {
  MdOutlineGridView,
  MdOutlineViewList,
  MdOutlineFilterList,
  MdOutlineKeyboardArrowDown,
  MdOutlineEmail,
  MdOutlinePerson,
  MdOutlineCalendarToday,
  MdOutlineDescription,
  MdOutlineMonetizationOn,
  MdOutlineReceiptLong,
  MdOutlineFolder,
  MdOutlineBeachAccess,
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
  MdOutlineCheckBox,
  MdCheckBoxOutlineBlank,
  MdOutlineRadioButtonChecked,
  MdOutlineRadioButtonUnchecked,
  MdOutlineClose,
} from "react-icons/md";

import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Ltr from "../../components/Ltr";

// ── Data ──────────────────────────────────────────────────────────────────────
const RESULTS = [
  {
    id: 1,
    category: "Employees",
    badge: "ACTIVE",
    badgeStyle: "text-green-700 bg-green-50 border-green-200",
    icon: null,
    avatar:
      "https://ui-avatars.com/api/?name=Ahmed+Al-Farsi&background=1e3a5f&color=fff&size=80",
    title: "Ahmed Al-Farsi",
    sub: "Senior Solutions Architect",
    detail: "ahmed.alfarsi@workforce.com",
    detailLtr: true,
    detailIcon: MdOutlineEmail,
    footerLeftKey: "searchResult.footerLabels.employee",
    footerRightKey: "searchResult.actions.viewProfile",
    footerRightColor: "text-cyan-600",
  },
  {
    id: 2,
    category: "Projects",
    badge: "IN PROGRESS",
    badgeStyle: "text-blue-700 bg-blue-50 border-blue-200",
    icon: MdOutlineFolder,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    title: "Ahmedabad Expansion",
    sub: "Global Infrastructure Group",
    hasProgress: true,
    progressPct: 65,
    footerLeftKey: "searchResult.footerLabels.project",
    footerRightKey: "searchResult.actions.viewRoadmap",
    footerRightColor: "text-cyan-600",
  },
  {
    id: 3,
    category: "Documents",
    badge: "PDF",
    badgeStyle: "text-gray-600 bg-gray-100 border-gray-200",
    icon: MdOutlineDescription,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
    title: "Ahmed_Contract_V2.pdf",
    sub: "Uploaded May 14, 2024",
    detail: "Owner: HR Dept",
    detailIcon: MdOutlinePerson,
    footerLeftKey: "searchResult.footerLabels.document",
    footerRightKey: "searchResult.actions.download",
    footerRightColor: "text-cyan-600",
  },
  {
    id: 4,
    category: "Payroll",
    badge: "PROCESSING",
    badgeStyle: "text-amber-700 bg-amber-50 border-amber-200",
    icon: MdOutlineMonetizationOn,
    iconBg: "bg-green-50",
    iconColor: "text-green-500",
    title: "Ahmed Mustafa",
    sub: "May 2024 Payroll Cycle",
    amount: "$8,450.00",
    footerLeftKey: "searchResult.footerLabels.payroll",
    footerRightKey: "searchResult.actions.reviewSlip",
    footerRightColor: "text-cyan-600",
  },
  {
    id: 5,
    category: "Leave",
    badge: "URGENT",
    badgeStyle: "text-red-700 bg-red-50 border-red-200",
    icon: MdOutlineBeachAccess,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "Ahmed Raza",
    sub: "Annual Leave Request",
    detail: "Jun 10 – Jun 24 (14 days)",
    detailIcon: MdOutlineCalendarToday,
    footerLeftKey: "searchResult.footerLabels.leave",
    footerRightKey: "searchResult.actions.actionRequest",
    footerRightColor: "text-cyan-600",
  },
  {
    id: 6,
    category: "Invoices",
    badge: "PAID",
    badgeStyle: "text-blue-700 bg-blue-50 border-blue-200",
    icon: MdOutlineReceiptLong,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    title: "INV-8834 (Ahmed Ent.)",
    titleLtr: true,
    sub: "Vendor: Ahmed Consulting Group",
    amount: "$12,200.00",
    footerLeftKey: "searchResult.footerLabels.invoice",
    footerRightKey: "searchResult.actions.viewBill",
    footerRightColor: "text-cyan-600",
  },
];

const CATEGORIES = [
  { label: "Employees", labelKey: "searchResult.categories.employees", count: null },
  { label: "Projects", labelKey: "searchResult.categories.projects", count: null },
  { label: "Payroll", labelKey: "searchResult.categories.payroll", count: null },
  { label: "Leave", labelKey: "searchResult.categories.leave", count: null },
  { label: "Documents", labelKey: "searchResult.categories.documents", count: null },
  { label: "Contracts", labelKey: "searchResult.categories.contracts", count: 12 },
  { label: "Invoices", labelKey: "searchResult.categories.invoices", count: 5 },
];

const SORT_OPTIONS = [
  { key: "relevance", labelKey: "searchResult.sort.relevance" },
  { key: "date", labelKey: "searchResult.sort.date" },
  { key: "name", labelKey: "searchResult.sort.name" },
  { key: "status", labelKey: "searchResult.sort.status" },
];

const STATUS_OPTIONS = [
  { value: "Active Only", labelKey: "searchResult.statusOptions.activeOnly" },
  { value: "Pending Approval", labelKey: "searchResult.statusOptions.pendingApproval" },
];

// ── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ item, list, t }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow ${list ? "flex items-center gap-4 px-5 py-4" : "p-5"}`}
    >
      {/* Top: Icon/Avatar + Badge */}
      {!list && (
        <div className="flex items-start justify-between mb-3">
          {item.avatar ? (
            <img
              src={item.avatar}
              alt={item.title}
              className="w-14 h-14 rounded-xl object-cover"
            />
          ) : (
            <div
              className={`w-12 h-12 ${item.iconBg} rounded-xl flex items-center justify-center`}
            >
              <item.icon className={`${item.iconColor} text-2xl`} />
            </div>
          )}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${item.badgeStyle}`}
          >
            {item.badge}
          </span>
        </div>
      )}

      {/* List view left side */}
      {list && (
        <div className="flex-shrink-0">
          {item.avatar ? (
            <img
              src={item.avatar}
              alt={item.title}
              className="w-10 h-10 rounded-xl object-cover"
            />
          ) : (
            <div
              className={`w-10 h-10 ${item.iconBg} rounded-xl flex items-center justify-center`}
            >
              <item.icon className={`${item.iconColor} text-lg`} />
            </div>
          )}
        </div>
      )}

      <div
        className={
          list
            ? "flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            : ""
        }
      >
        <div className={list ? "min-w-0" : ""}>
          <p className="text-sm font-bold text-gray-900 truncate">
            {item.titleLtr ? <Ltr>{item.title}</Ltr> : item.title}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{item.sub}</p>

          {item.detail && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
              <item.detailIcon className="text-gray-400 text-sm flex-shrink-0" />
              <span className="truncate">
                {item.detailLtr ? <Ltr>{item.detail}</Ltr> : item.detail}
              </span>
            </div>
          )}
          {item.hasProgress && !list && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-cyan-600 rounded-full"
                style={{ width: `${item.progressPct}%` }}
              />
            </div>
          )}
          {item.amount && (
            <p
              className={`font-bold text-gray-900 ${list ? "text-sm" : "text-xl mt-2"}`}
            >
              <Ltr>{item.amount}</Ltr>
            </p>
          )}
        </div>

        {list && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${item.badgeStyle}`}
          >
            {item.badge}
          </span>
        )}
      </div>

      {!list && (
        <>
          <div className="border-t border-gray-100 mt-4 pt-3 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {t(item.footerLeftKey)}
            </span>
            <button
              className={`text-sm font-semibold ${item.footerRightColor} hover:opacity-80 transition-opacity`}
            >
              {t(item.footerRightKey)}
            </button>
          </div>
        </>
      )}

      {list && (
        <button
          className={`text-sm font-semibold flex-shrink-0 ${item.footerRightColor} hover:opacity-80 transition-opacity hidden sm:block`}
        >
          {t(item.footerRightKey)}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SearchResult({ query = "Ahmed" }) {
  const { t } = useTranslation("shared");
  const [params] = useSearchParams();
  const queryData = params.get("q");
  const [viewMode, setViewMode] = useState("grid");
  const [sort, setSort] = useState(SORT_OPTIONS[0].key);
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState(
    CATEGORIES.reduce((a, c) => ({ ...a, [c.label]: !c.count }), {}),
  );
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const TOTAL_PAGES = 12;

  const toggleCat = (label) =>
    setCategories((p) => ({ ...p, [label]: !p[label] }));

  const FilterPanel = ({ mobile }) => (
    <div className={mobile ? "space-y-5" : "space-y-5"}>
      {/* Categories */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          {t("searchResult.categoriesTitle")}
        </p>
        <div className="space-y-2">
          {CATEGORIES.map(({ label, labelKey, count }) => (
            <label
              key={label}
              onClick={() => toggleCat(label)}
              className="flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                {categories[label] ? (
                  <MdOutlineCheckBox className="text-cyan-600 text-xl flex-shrink-0" />
                ) : (
                  <MdCheckBoxOutlineBlank className="text-gray-300 text-xl flex-shrink-0 group-hover:text-gray-400" />
                )}
                <span
                  className={`text-sm ${categories[label] ? "text-gray-800 font-medium" : "text-gray-500"}`}
                >
                  {t(labelKey)}
                </span>
              </div>
              {count && (
                <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          {t("searchResult.statusTitle")}
        </p>
        <div className="space-y-2">
          {STATUS_OPTIONS.map(({ value, labelKey }) => (
            <label
              key={value}
              onClick={() => setStatus(status === value ? "" : value)}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              {status === value ? (
                <MdOutlineRadioButtonChecked className="text-cyan-600 text-xl flex-shrink-0" />
              ) : (
                <MdOutlineRadioButtonUnchecked className="text-gray-300 text-xl flex-shrink-0" />
              )}
              <span
                className={`text-sm ${status === value ? "text-gray-800 font-medium" : "text-gray-500"}`}
              >
                {t(labelKey)}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
 
      <div className="space-y-5">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("searchResult.heading")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("searchResult.subtitle", { query: queryData })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {/* View Toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2.5 transition-colors ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-50"}`}
              >
                <MdOutlineGridView className="text-xl" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-50"}`}
              >
                <MdOutlineViewList className="text-xl" />
              </button>
            </div>

            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => setShowSort((v) => !v)}
                className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="truncate max-w-[130px]">
                  {t(SORT_OPTIONS.find((o) => o.key === sort)?.labelKey)}
                </span>
                <MdOutlineKeyboardArrowDown
                  className={`text-gray-400 transition-transform flex-shrink-0 ${showSort ? "rotate-180" : ""}`}
                />
              </button>
              {showSort && (
                <div className="absolute end-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setSort(opt.key);
                        setShowSort(false);
                      }}
                      className={`w-full text-start px-4 py-2.5 text-sm transition-colors ${sort === opt.key ? "bg-cyan-50 text-cyan-600 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="lg:hidden flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <MdOutlineFilterList className="text-lg" /> {t("searchResult.filters")}
            </button>
          </div>
        </div>

        {/* ── Mobile Filter Drawer ── */}
        {showFilters && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setShowFilters(false)}
            />
            <div className="relative mt-auto bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 sticky top-0 bg-white">
                <p className="text-base font-bold text-gray-900">
                  {t("searchResult.filters")}
                </p>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-1 text-gray-400 hover:text-gray-700"
                >
                  <MdOutlineClose className="text-xl" />
                </button>
              </div>
              <div className="p-4">
                <FilterPanel mobile />
              </div>
            </div>
          </div>
        )}

        {/* ── Body: Sidebar + Results ── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-52 flex-shrink-0">
            <FilterPanel />
          </div>

          {/* Results Grid / List */}
          <div className="flex-1 min-w-0">
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                  : "flex flex-col gap-3"
              }
            >
              {RESULTS.map((item) => (
                <ResultCard
                  key={item.id}
                  item={item}
                  list={viewMode === "list"}
                  t={t}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end gap-1 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdOutlineChevronLeft className="rtl:rotate-180" />
              </button>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    page === n
                      ? "bg-cyan-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="px-1 text-gray-400 text-sm">...</span>
              <button
                onClick={() => setPage(TOTAL_PAGES)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors ${page === TOTAL_PAGES ? "bg-cyan-600 text-white border-cyan-600" : ""}`}
              >
                {TOTAL_PAGES}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}
                disabled={page === TOTAL_PAGES}
                className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdOutlineChevronRight className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>

  );
}

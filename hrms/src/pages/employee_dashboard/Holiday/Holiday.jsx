import { useState, useMemo } from "react";
import {
  MdChevronLeft,
  MdChevronRight,
  MdArrowUpward,
  MdArrowDownward,
  MdSearch,
  MdOutlineCalendarToday,
  MdOutlineClear,
} from "react-icons/md";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Loader, { TableLoader } from "../../../components/Loader";
import { useFormat } from "../../../hooks/useFormat";
import { HOLIDAYS } from "../../../data/groupH";
import { matches, paginate } from "../../../data/common";
import Ltr from "../../../components/Ltr";
import CustomDropdown from "../../../components/CustomDropdown";
import useFiscalYear from "../../../hooks/useFiscalYear";

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Holiday() {
  const { t } = useTranslation("holidays");
  const { fmtDate } = useFormat();
  const [searchTerm, setSearchTerm] = useState("");
  const [holidayType, setHolidayType] = useState("All Types");
  const [uniqueTypes] = useState(() => [
    "All Types",
    ...new Set(HOLIDAYS.map((holiday) => holiday.holiday_type)),
  ]);
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  // The selected financial year's holidays; page back to 1 when it changes.
  const fy = useFiscalYear();
  const [pageState, setPageState] = useState({ version: fy.version, page: 1 });
  const page = pageState.version === fy.version ? pageState.page : 1;
  const setPage = (p) =>
    setPageState((prev) => {
      const cur = prev.version === fy.version ? prev.page : 1;
      return { version: fy.version, page: typeof p === "function" ? p(cur) : p };
    });
  const loading = false;
  const PAGE_SIZE = 10;
  const rangeFrom = fy.range?.from;
  const rangeTo = fy.range?.to;

  // Client-side search / type filter / sort / paging over the static list.
  const filtered = useMemo(() => {
    const rows = HOLIDAYS.filter(
      (h) =>
        (!rangeFrom || (h.holiday_date >= rangeFrom && h.holiday_date <= rangeTo)) &&
        matches(h, searchTerm, ["holiday_name", "holiday_type"]) &&
        (holidayType === "All Types" || h.holiday_type === holidayType),
    );
    const keyOf = (h) =>
      sortField === "day"
        ? new Date(h.holiday_date).getDay()
        : sortField === "id"
          ? h.id
          : String(h[sortField] ?? "");
    return [...rows].sort((a, b) => {
      const x = keyOf(a);
      const y = keyOf(b);
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rangeFrom, rangeTo, searchTerm, holidayType, sortField, sortDir]);

  const {
    rows: paginated,
    totalPages,
    total: totalCount,
  } = paginate(filtered, page, PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("subtitle")}
              {fy.label && (
                <span className="ms-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100">
                  {fy.label}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Link
              to="/employee/calendar"
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              <MdOutlineCalendarToday className="text-base" /> {t("viewCalendar")}
            </Link>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("filters.searchLabel")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                  <MdSearch className="text-gray-400 text-lg" />
                </div>
                <input
                  type="text"
                  placeholder={t("filters.searchPlaceholderEmployee")}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none border border-gray-200 rounded-lg ps-10 px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-[42px]"
                />
              </div>
            </div>

            {/* Type */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("filters.holidayType")}
              </label>
              <div className="relative">
                <CustomDropdown
                  value={holidayType}
                  onChange={(e) => {
                    setHolidayType(e.target.value);
                    setPage(1);
                  }}
                  options={uniqueTypes.map((type) => ({
                    label: type === "All Types" ? t("filters.allTypes") : type,
                    value: type
                  }))}
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setHolidayType("All Types");
                  setPage(1);
                }}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("filters.clearFilters", { defaultValue: "Clear Filters" })}
              </button>
            </div>
          </div>
        </div>

        {/* ── Holiday Table ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-5 py-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t("table.sn")}
                    </span>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("holiday_name")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("table.holidayName")}
                      {sortField === "holiday_name" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("holiday_date")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("table.date")}
                      {sortField === "holiday_date" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("day")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("table.day")}
                      {sortField === "day" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("holiday_type")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("table.type")}
                      {sortField === "holiday_type" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <TableLoader colSpan={5} />
                ) : paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-sm text-gray-400"
                    >
                      {t("emptySearch")}
                    </td>
                  </tr>
                ) : (
                  paginated.map((holiday, index) => {
                    return (
                      <tr
                        key={holiday.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-900 text-sm">
                          {holiday.holiday_name}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          <Ltr>
                            {fmtDate(holiday.holiday_date, {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            })}
                          </Ltr>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {fmtDate(holiday.holiday_date, { weekday: "long" })}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold text-green-700 bg-green-50 border border-green-200">
                            {holiday.holiday_type || t("defaultType")}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <Loader />
            ) : paginated.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("emptySearch")}
              </div>
            ) : (
              paginated.map((holiday, index) => {
                return (
                  <div key={holiday.id} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200">
                            #{(page - 1) * PAGE_SIZE + index + 1}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-green-700 bg-green-50 border border-green-200">
                            {holiday.holiday_type || t("defaultType")}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-900">
                          {holiday.holiday_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>
                        {t("card.dateLabel")}{" "}
                        <strong className="text-gray-800">
                          <Ltr>
                            {fmtDate(holiday.holiday_date, {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            })}
                          </Ltr>
                        </strong>
                      </span>
                      <span>
                        {t("card.dayLabel")}{" "}
                        <strong className="text-gray-800">
                          {fmtDate(holiday.holiday_date, { weekday: "long" })}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-400 order-2 sm:order-1">
              {t("pagination.showing")}{" "}
              <span className="font-semibold text-gray-600">
                {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, totalCount)}
              </span>{" "}
              {t("pagination.of")}{" "}
              <span className="font-semibold text-gray-600">{totalCount}</span>{" "}
              {t("pagination.holidays")}
            </p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdChevronLeft className="rtl:rotate-180" />
              </button>
              {Array.from(
                { length: Math.min(totalPages, 3) },
                (_, i) => i + 1,
              ).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${page === n
                      ? "bg-cyan-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {n}
                </button>
              ))}
              {totalPages > 3 && (
                <span className="px-1 text-gray-400 text-sm">...</span>
              )}
              {totalPages > 3 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${page === totalPages
                      ? "bg-cyan-600 text-white border-cyan-600"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {totalPages}
                </button>
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdChevronRight className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

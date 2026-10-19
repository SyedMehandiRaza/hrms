import { useEffect, useMemo, useState } from "react";
import Pagination from "../../components/Pagination";
import { useTranslation } from "react-i18next";
import {
  MdChevronLeft,
  MdChevronRight,
  MdHowToReg,
  MdPersonOff,
  MdBeachAccess,
  MdOutlineSearch,
  MdKeyboardArrowDown,
  MdOutlineClear,
} from "react-icons/md";

import {
  ATT_PROJECTS,
  ATT_getSummary,
  ATT_getDaily,
  ATT_getMonthly,
  ATT_getEmployeeDay,
} from "../../data/groupD";
import { TableLoader } from "../../components/Loader";
import Ltr from "../../components/Ltr";
import AttendanceDetailModal from "../../components/AttendanceDetailModal";
import CustomDropdown from "../../components/CustomDropdown";
import useFiscalYear from "../../hooks/useFiscalYear";
import { clampDate } from "../../utils/fiscalYear";

const LIMIT = 10;

// ── formatting helpers ──
const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "--";

const fmtHours = (h, status) => {
  if (status === "INCOMPLETE" || h == null) return "--";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
};

const STATUS_STYLES = {
  PRESENT: "text-green-700 bg-green-50 border-green-200",
  INCOMPLETE: "text-amber-700 bg-amber-50 border-amber-200",
  ABSENT: "text-red-700 bg-red-50 border-red-200",
  WEEKLY_OFF: "text-gray-600 bg-gray-100 border-gray-200",
  HOLIDAY: "text-purple-700 bg-purple-50 border-purple-200",
  LEAVE: "text-blue-700 bg-blue-50 border-blue-200",
  FUTURE: "text-gray-400 bg-gray-50 border-gray-100",
  NA: "text-gray-400 bg-gray-50 border-gray-100",
  OP: "text-slate-600 bg-slate-100 border-slate-200",
};
const STATUS_LABEL = {
  PRESENT: "Present",
  INCOMPLETE: "Incomplete",
  ABSENT: "Absent",
  WEEKLY_OFF: "Weekly Off",
  HOLIDAY: "Holiday",
  LEAVE: "Leave",
  FUTURE: "—",
  NA: "Not joined yet",
  OP: "On another project",
};
// Monthly matrix short codes
const CELL = {
  PRESENT: { code: "P", cls: "bg-green-100 text-green-700" },
  INCOMPLETE: { code: "I", cls: "bg-amber-100 text-amber-700" },
  ABSENT: { code: "A", cls: "bg-red-100 text-red-700" },
  WEEKLY_OFF: { code: "WO", cls: "bg-gray-100 text-gray-400" },
  HOLIDAY: { code: "H", cls: "bg-purple-100 text-purple-700" },
  LEAVE: { code: "L", cls: "bg-blue-100 text-blue-700" },
  NA: { code: "NA", cls: "bg-gray-50 text-gray-400" },
  OP: { code: "OP", cls: "bg-slate-100 text-slate-600" },
};

const STATUS_FILTERS = [
  "PRESENT",
  "INCOMPLETE",
  "ABSENT",
  "WEEKLY_OFF",
  "HOLIDAY",
];

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

const StatCard = ({ label, value, subtext, icon, iconBg, alert }) => {
  const { t } = useTranslation("attendance");
  return (
  <div
    className={`relative border rounded-xl p-5 bg-white ${alert ? "border-red-200 shadow-sm shadow-red-100" : "border-gray-200"}`}
  >
    <div className="flex justify-between items-start mb-4">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}
      >
        {icon}
      </div>
      {alert && value > 0 && (
        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-red-500 text-white">
          {t("tracker.stats.alert")}
        </span>
      )}
    </div>
    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
      {label}
    </p>
    <h3 className="text-3xl font-bold text-gray-900 mb-1">{value}</h3>
    <p className="text-xs text-gray-400">{subtext}</p>
  </div>
  );
};

export default function Attendance() {
  const { t } = useTranslation("attendance");
  const statusLabel = (s) => t(`attendanceStatus.${s}`, { defaultValue: STATUS_LABEL[s] });
  const projects = ATT_PROJECTS;
  const fy = useFiscalYear();

  const [viewMode, setViewMode] = useState("daily"); // "daily" | "monthly"
  const [date, setDate] = useState(fy.defaultDate);
  const [month, setMonth] = useState(fy.defaultMonth);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const loading = false;

  // dropdown states
  const [showMonthDrop, setShowMonthDrop] = useState(false);
  const [showYearDrop, setShowYearDrop] = useState(false);

  // day-timeline modal
  const [dayModal, setDayModal] = useState(null); // { employee, date }
  const [dayData, setDayData] = useState(null);
  const dayLoading = false;

  // A new financial year in the header → back to its default day / month.
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setDate(fy.defaultDate);
    setMonth(fy.defaultMonth);
    setPage(1);
    setDayModal(null);
  }

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Summary follows the selected date.
  const summary = useMemo(() => ATT_getSummary(date), [date]);

  // Daily / Monthly list (static, filtered client-side).
  const daily = useMemo(
    () => ATT_getDaily({ date, page, limit: LIMIT, projectId, search, status }),
    [date, page, projectId, search, status],
  );
  const monthly = useMemo(
    () => ATT_getMonthly({ month, page, limit: LIMIT, projectId, search }),
    [month, page, projectId, search],
  );

  const switchView = (mode) => {
    setViewMode(mode);
    setPage(1);
  };

  const totalPages =
    viewMode === "daily" ? daily.total_pages : monthly.total_pages;
  const totalCount = viewMode === "daily" ? daily.total : monthly.total;

  const openDay = (employee, dStr) => {
    setDayModal({ employee, date: dStr });
    setDayData(ATT_getEmployeeDay(employee.employee_id, dStr));
  };

  // Keep modal's employee data in sync when changing months
  const modalEmployee =
    dayModal && viewMode === "monthly"
      ? monthly.data.find((e) => e.employee_id === dayModal.employee.employee_id) || dayModal.employee
      : dayModal?.employee;

  const monthDays = useMemo(
    () => Array.from({ length: monthly.days_in_month }, (_, i) => i + 1),
    [monthly.days_in_month],
  );

  // Months of the selected FY, in FY order (Apr…Mar for an April company).
  const fyMonths = fy.months;
  const monthIdx = fyMonths.findIndex((m) => m.value === month);
  const canPrevMonth = monthIdx > 0;
  const canNextMonth = monthIdx >= 0 && monthIdx < fyMonths.length - 1;

  // Prev / next stay inside the FY (the detail modal steps the same way).
  const shiftMonth = (delta) => {
    const next = fyMonths[monthIdx + delta];
    if (!next) return;
    setMonth(next.value);
    setPage(1);
  };

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = (m) =>
    t(`months.${MONTHS[m - 1]?.toLowerCase()}`, { defaultValue: MONTHS[m - 1] });

  const [yStr, mStr] = month.split("-");
  const currentYearNum = parseInt(yStr, 10);
  const currentMonthNum = parseInt(mStr, 10);

  const handleMonthSelect = (value) => {
    setMonth(value);
    setShowMonthDrop(false);
    setPage(1);
  };

  // The year dropdown is the financial year (same as the header switcher).
  const handleYearSelect = (yearKey) => {
    setShowYearDrop(false);
    // Static build: the financial year is fixed, nothing to switch to.
    void yearKey;
  };
  const fyOptions = [...fy.years].sort((a, b) => b.year_key - a.year_key);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("tracker.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("tracker.subtitle")}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label={t("tracker.stats.totalPresent")}
          value={summary?.present ?? "—"}
          subtext={
            summary
              ? t("tracker.stats.ofEmployees", { total: summary.total_employees })
              : t("common.loading")
          }
          icon={<MdHowToReg className="text-green-600 text-xl" />}
          iconBg="bg-green-50"
        />
        <StatCard
          label={t("tracker.stats.absent")}
          value={summary?.absent ?? "—"}
          subtext={t("tracker.stats.notCheckedIn")}
          icon={<MdPersonOff className="text-gray-600 text-xl" />}
          iconBg="bg-gray-100"
        />
        <StatCard
          label={t("tracker.stats.weeklyOffHoliday")}
          value={
            summary ? (summary.weekly_off ?? 0) + (summary.holiday ?? 0) : "—"
          }
          subtext={t("tracker.stats.weeklyOffsHolidays")}
          icon={<MdBeachAccess className="text-gray-600 text-xl" />}
          iconBg="bg-gray-100"
        />
        <StatCard
          label={t("tracker.stats.missingCheckIns")}
          value={summary?.missing_check_ins ?? "—"}
          subtext={t("tracker.stats.noCheckOut")}
          icon={<span className="text-red-500 font-bold text-lg">!</span>}
          iconBg="bg-red-50"
          alert
        />
      </div>

      {/* Filters + view toggle */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-wrap items-end gap-3">
          {viewMode === "daily" ? (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("tracker.filters.date")}
              </label>
              <input
                type="date"
                value={date}
                min={fy.range?.from}
                max={fy.range?.to}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDate(fy.range ? clampDate(e.target.value, fy.range) : e.target.value);
                  setPage(1);
                }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 h-[42px]"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("tracker.filters.dateRange")}
              </label>
              <div className="flex items-center gap-2 h-[42px]">
                <button
                  onClick={() => shiftMonth(-1)}
                  disabled={!canPrevMonth}
                  className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <MdChevronLeft className="rtl:rotate-180 text-xl" />
                </button>

                <div className="flex items-center gap-1">
                  {/* Month Dropdown */}
                  <div
                    className="relative"
                    tabIndex={0}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) setShowMonthDrop(false);
                    }}
                  >
                    <button
                      onClick={() => setShowMonthDrop(!showMonthDrop)}
                      className="h-10 px-3 border border-gray-200 rounded-md text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 flex items-center justify-between min-w-[100px]"
                    >
                      <span className="whitespace-nowrap">{monthName(currentMonthNum)} {currentYearNum}</span>
                      <MdKeyboardArrowDown className="text-gray-400 ms-1" />
                    </button>
                    {showMonthDrop && (
                      <div className="absolute top-full mt-1 start-0 w-40 bg-white border border-gray-200 shadow-lg rounded-xl py-2 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                        {fyMonths.map((m) => (
                          <div
                            key={m.value}
                            onClick={() => handleMonthSelect(m.value)}
                            className={`px-4 py-2 text-sm cursor-pointer whitespace-nowrap hover:bg-cyan-50 hover:text-cyan-700 transition-colors ${month === m.value ? 'bg-cyan-100 text-cyan-800 font-bold' : 'text-gray-600'}`}
                          >
                            {monthName(m.month)} {m.year}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Year Dropdown */}
                  <div
                    className="relative"
                    tabIndex={0}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) setShowYearDrop(false);
                    }}
                  >
                    <button
                      onClick={() => setShowYearDrop(!showYearDrop)}
                      className="h-10 px-3 border border-gray-200 rounded-md text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 flex items-center justify-between min-w-[90px]"
                    >
                      <span className="whitespace-nowrap">{fy.label}</span>
                      <MdKeyboardArrowDown className="text-gray-400 ms-1" />
                    </button>
                    {showYearDrop && (
                      <div className="absolute top-full mt-1 start-0 w-36 bg-white border border-gray-200 shadow-lg rounded-xl py-2 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                        {fyOptions.map((y) => (
                          <div
                            key={y.year_key}
                            onClick={() => handleYearSelect(y.year_key)}
                            className={`px-4 py-2 text-sm cursor-pointer whitespace-nowrap hover:bg-cyan-50 hover:text-cyan-700 transition-colors ${fy.selected === y.year_key ? 'bg-cyan-100 text-cyan-800 font-bold' : 'text-gray-600'}`}
                          >
                            {y.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => shiftMonth(1)}
                  disabled={!canNextMonth}
                  className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <MdChevronRight className="rtl:rotate-180 text-xl" />
                </button>
              </div>
            </div>
          )}

          {/* Project */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {t("tracker.filters.project")}
            </label>
            <CustomDropdown
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPage(1);
              }}
              options={[
                { label: t("common.allProjects"), value: "" },
                ...projects.map((p) => ({
                  label: p.project_name,
                  value: p.id
                }))
              ]}
            />
          </div>

          {/* Status (daily only) */}
          {viewMode === "daily" && (
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("tracker.filters.status")}
              </label>
              <CustomDropdown
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: t("common.allStatuses"), value: "" },
                  ...STATUS_FILTERS.map((s) => ({
                    label: statusLabel(s),
                    value: s
                  }))
                ]}
              />
            </div>
          )}

          {/* Search */}
          <div className="flex-1 min-w-[180px] flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider opacity-0 select-none">
              {t("common.search")}
            </label>
            <div className="relative">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("tracker.filters.searchPlaceholder")}
                className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 h-[42px]"
              />
            </div>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto h-[42px] self-end mt-2 sm:mt-0">
            <button
              onClick={() => {
                setProjectId("");
                setStatus("");
                setSearchInput("");
                setDate(fy.defaultDate);
                setMonth(fy.defaultMonth); // back to the FY's default month
                setPage(1);
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("common.clearFilters")}
            </button>
          </div>

          {/* View toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg self-end h-[42px] w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
            <button
              onClick={() => switchView("daily")}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === "daily" ? "bg-cyan-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"} h-full`}
            >
              {t("tracker.filters.daily")}
            </button>
            <button
              onClick={() => switchView("monthly")}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === "monthly" ? "bg-cyan-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"} h-full`}
            >
              {t("tracker.filters.monthly")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Daily Table ── */}
      {viewMode === "daily" ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    t("tracker.columns.sn"),
                    t("tracker.columns.employee"),
                    t("tracker.columns.project"),
                    t("tracker.columns.checkIn"),
                    t("tracker.columns.checkOut"),
                    t("tracker.columns.totalHours"),
                    t("tracker.columns.status"),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-start px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && daily.data.length === 0 ? (
                  <TableLoader colSpan={7} label={t("common.loading")} />
                ) : daily.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-14 text-center text-sm text-gray-400"
                    >
                      {t("tracker.noAttendance")}
                    </td>
                  </tr>
                ) : (
                  daily.data.map((row, i) => (
                    <tr
                      key={row.employee_id}
                      onClick={() => openDay(row, row.work_date)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {(page - 1) * LIMIT + i + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-cyan-50 text-cyan-700 text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {row.profile_url ? (
                              <img src={row.profile_url} alt={row.full_name} className="w-full h-full object-cover" />
                            ) : (
                              initials(row.full_name)
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {row.full_name}
                            </p>
                            <p className="text-xs text-gray-400">
                              <Ltr>{row.country_emp_id}</Ltr>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {row.project_name || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <Ltr>{fmtTime(row.check_in_time)}</Ltr>
                      </td>
                      <td
                        className={`px-5 py-4 text-sm font-medium ${row.missing_checkout ? "text-red-500" : "text-gray-700"}`}
                      >
                        {row.missing_checkout ? (
                          t("tracker.missing")
                        ) : (
                          <Ltr>{fmtTime(row.check_out_time)}</Ltr>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">
                        <Ltr>{fmtHours(row.total_hours, row.status)}</Ltr>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${STATUS_STYLES[row.status]}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                        {row.is_late && (
                          <span className="ms-2 text-[10px] font-bold text-amber-600">
                            {t("tracker.late")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalCount}
            limit={LIMIT}
            onPage={setPage}
          />
        </div>
      ) : (
        /* ── Monthly Matrix ── */
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="border border-gray-200 rounded-xl overflow-x-auto custom-scrollbar">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky start-0 z-20 bg-gray-50 border-e border-gray-200 py-3 px-4 text-start font-bold text-gray-700 min-w-[200px]">
                    {t("tracker.columns.employee")}
                  </th>
                  {monthDays.map((d) => (
                    <th
                      key={d}
                      className="border-e border-gray-200 py-3 px-1 font-bold text-gray-600 min-w-[34px]"
                    >
                      {d}
                    </th>
                  ))}
                  <th className="py-3 px-4 font-bold text-gray-700 min-w-[120px]">
                    {t("tracker.columns.summary")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && monthly.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={monthly.days_in_month + 2}
                      className="py-14 text-center text-sm text-gray-400"
                    >
                      {t("common.loading")}
                    </td>
                  </tr>
                ) : monthly.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={monthly.days_in_month + 2}
                      className="py-14 text-center text-sm text-gray-400"
                    >
                      {t("tracker.noEmployees")}
                    </td>
                  </tr>
                ) : (
                  monthly.data.map((emp) => (
                    <tr key={emp.employee_id} className="border-t border-gray-200">
                      <td className="sticky start-0 z-10 bg-white border-e border-gray-200 py-2 px-4 text-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-50 text-cyan-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 overflow-hidden hidden sm:flex">
                            {emp.profile_url ? (
                              <img src={emp.profile_url} alt={emp.full_name} className="w-full h-full object-cover" />
                            ) : (
                              initials(emp.full_name)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-[13px]">
                              {emp.full_name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              <Ltr>{emp.country_emp_id}</Ltr>
                            </p>
                          </div>
                        </div>
                      </td>
                      {monthDays.map((d) => {
                        const st = emp.days[d];
                        // Future days (and unknowns) render blank, not clickable.
                        if (!st || st === "FUTURE") {
                          return (
                            <td
                              key={d}
                              className="border-e border-gray-200 py-1.5 px-1"
                            >
                              <div className="w-7 h-7 mx-auto" />
                            </td>
                          );
                        }
                        const cell = CELL[st] || CELL.ABSENT;
                        return (
                          <td
                            key={d}
                            className="border-e border-gray-200 py-1.5 px-1"
                          >
                            <div
                              onClick={() =>
                                openDay(emp, `${emp_monthDate(month, d)}`)
                              }
                              className={`w-7 h-7 mx-auto rounded flex items-center justify-center font-bold text-[10px] cursor-pointer hover:opacity-80 ${cell.cls}`}
                            >
                              {t(`cellCode.${CELL[st] ? st : "ABSENT"}`, { defaultValue: cell.code })}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2 px-4">
                        <div className="flex gap-2 font-bold text-[11px] justify-center">
                          <span className="text-green-600">
                            {t("tracker.summaryPresent", { value: emp.summary.present })}
                          </span>
                          <span className="text-red-500">
                            {t("tracker.summaryAbsent", { value: emp.summary.absent })}
                          </span>
                          <span className="text-gray-500">
                            {emp.summary.attendance_pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalCount}
            limit={LIMIT}
            onPage={setPage}
            label={t("common.employeesLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
          />
        </div>
      )}

      <AttendanceDetailModal
        isOpen={!!dayModal}
        onClose={() => setDayModal(null)}
        employee={modalEmployee}
        date={dayModal?.date}
        loading={dayLoading}
        dayData={dayData}
        viewMode={viewMode}
        currentMonth={month}
        onDayClick={(dStr) => openDay(dayModal.employee, dStr)}
        onShiftMonth={(delta) => shiftMonth(delta)}
      />
    </div>
  );
}

// month "YYYY-MM" + day → "YYYY-MM-DD"
function emp_monthDate(month, day) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

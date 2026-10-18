import { useState } from "react";
import Pagination from "../../components/Pagination";
import {
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
  MdOutlineFilterList,
  MdOutlineAdd,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
  MdOutlineTune,
} from "react-icons/md";

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Ltr from "../../components/Ltr";
import CustomDropdown from "../../components/CustomDropdown";
import React from "react";
import {
  LS_ALL_LEAVE_BALANCES,
  LS_BALANCE_YEAR,
  LS_CALENDAR_LEAVES,
  LS_HOLIDAYS,
} from "../../data/groupD";
import { paginate } from "../../data/common";
import useFiscalYear from "../../hooks/useFiscalYear";
import useFyMonthNav from "../../hooks/useFyMonthNav";
import useYearLock from "../../hooks/useYearLock";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CarriedLeaveNote from "../../components/leave/CarriedLeaveNote";
import AdjustLeaveBalanceModal from "../../components/leave/AdjustLeaveBalanceModal";

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK_KEYS = [
  "weekdaysShort.sun",
  "weekdaysShort.mon",
  "weekdaysShort.tue",
  "weekdaysShort.wed",
  "weekdaysShort.thu",
  "weekdaysShort.fri",
  "weekdaysShort.sat",
];
const MONTH_KEYS = [
  "months.january",
  "months.february",
  "months.march",
  "months.april",
  "months.may",
  "months.june",
  "months.july",
  "months.august",
  "months.september",
  "months.october",
  "months.november",
  "months.december",
];

// Event color class strings (reused so the visual style stays unchanged).
const EVENT_COLOR_APPROVED =
  "bg-green-100 text-green-700 border-s-2 border-green-500";

// ── Helpers ───────────────────────────────────────────────────────────────────
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const padDate = (n) => String(n).padStart(2, "0");

// ── Calendar Grid ─────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, holidaysByDate = {}, eventsByDate = {} }) {
  const { t } = useTranslation("leaves");
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  const cells = [];

  // Leading days from prev month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false, dateKey: null });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${padDate(month + 1)}-${padDate(d)}`;
    cells.push({ day: d, current: true, dateKey });
  }
  // Trailing days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false, dateKey: null });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS_OF_WEEK_KEYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider"
            >
              {t(d)}
            </div>
          ))}
        </div>
        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-gray-100 last:border-0"
          >
            {week.map((cell, ci) => {
              const events = cell.dateKey ? eventsByDate[cell.dateKey] || [] : [];
              const holidayNames = cell.dateKey
                ? holidaysByDate[cell.dateKey] || []
                : [];
              return (
                <div
                  key={ci}
                  className={`min-h-[80px] p-2 border-e border-gray-100 last:border-e-0 transition-colors hover:bg-gray-50/50 ${
                    !cell.current ? "bg-gray-50/30" : ""
                  } ${holidayNames.length ? "bg-amber-50/40" : ""}`}
                >
                  <span
                    className={`text-sm font-medium ${cell.current ? "text-gray-800" : "text-gray-300"}`}
                  >
                    <Ltr>{cell.day}</Ltr>
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {holidayNames.map((name, hi) => (
                      <div
                        key={`h-${hi}`}
                        title={name}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate leading-tight bg-amber-100 text-amber-700 border-s-2 border-amber-400"
                      >
                        {name}
                      </div>
                    ))}
                    {events.map((ev, ei) => (
                      <div
                        key={ei}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate leading-tight ${ev.color}`}
                      >
                        {ev.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LeaveCalendar() {
  const { t } = useTranslation("leaves");
  const [viewMode, setViewMode] = useState("Month");
  // Calendar month: inside the selected financial year, reset on year change.
  const fy = useFiscalYear();
  const lock = useYearLock();
  const nav = useFyMonthNav();
  const { year, month } = nav;
  const [teams, setTeams] = useState({
    Engineering: true,
    Design: true,
    Product: false,
  });
  const [projectFilter, setProjectFilter] = useState("All Projects");

  // FY balances of every employee (client-side paging, 10 per page).
  const [allBalances, setAllBalances] = useState(LS_ALL_LEAVE_BALANCES);
  const balanceYear = LS_BALANCE_YEAR;

  // Recent requests: the latest 20 leave requests (any status).
  const recentRequestsData = LS_CALENDAR_LEAVES.slice(0, 20);
  const loading = false;

  // Balance page — back to 1 whenever the financial year changes.
  const [balancePageState, setBalancePageState] = useState({ version: fy.version, page: 1 });
  const balancePage = balancePageState.version === fy.version ? balancePageState.page : 1;
  const setBalancePage = (p) => setBalancePageState({ version: fy.version, page: p });
  const {
    rows: balancesArray,
    total: balancesTotalCount,
    totalPages: balancesTotalPages,
  } = paginate(allBalances, balancePage, 10);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);
  const [adjusting, setAdjusting] = useState(null); // { balance, employeeName }

  const toggleExpand = (id) => {
    setExpandedEmployeeId(expandedEmployeeId === id ? null : id);
  };

  // Apply an adjusted balance row to its employee (totals follow the row).
  const applyAdjusted = (updated) => {
    if (!updated?.balance_id) return;
    setAllBalances((prev) =>
      prev.map((row) => {
        if (!row.leave_balances.some((lb) => lb.balance_id === updated.balance_id)) return row;
        const leave_balances = row.leave_balances.map((lb) =>
          lb.balance_id === updated.balance_id
            ? { ...lb, allocated: updated.allocated, balance: updated.balance }
            : lb,
        );
        const sum = (k) => Math.round(leave_balances.reduce((s, lb) => s + Number(lb[k] || 0), 0) * 100) / 100;
        return {
          ...row,
          leave_balances,
          total_allocated: sum("allocated"),
          total_consumed: sum("used"),
          total_available_balance: sum("balance"),
        };
      }),
    );
  };

  // Holidays of the visible month, by date (yellow markers).
  const holidaysByDate = {};
  LS_HOLIDAYS.forEach((h) => {
    const key = String(h.holiday_date).slice(0, 10);
    if (Number(key.slice(0, 4)) !== year || Number(key.slice(5, 7)) !== month + 1) return;
    if (!holidaysByDate[key]) holidaysByDate[key] = [];
    holidaysByDate[key].push(h.holiday_name);
  });

  // Approved leaves of the visible month → events map
  // ("YYYY-MM-DD" -> [{ label, color }]) consumed by the calendar grid.
  const eventsByDate = {};
  // Pad numbers to "YYYY-MM-DD" using local date parts.
  const toKey = (dt) =>
    `${dt.getFullYear()}-${padDate(dt.getMonth() + 1)}-${padDate(dt.getDate())}`;
  LS_CALENDAR_LEAVES.filter((row) => row.status === "APPROVED").forEach((row) => {
    if (!row?.from_date || !row?.to_date) return;
    const start = new Date(`${String(row.from_date).slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(row.to_date).slice(0, 10)}T00:00:00`);
    if (isNaN(start) || isNaN(end)) return;

    const label = `${row.employee_name} (${row.leave_type})`;
    // Loop dates inclusively; only keep dates in the visible month.
    for (
      let cur = new Date(start);
      cur <= end;
      cur.setDate(cur.getDate() + 1)
    ) {
      if (cur.getFullYear() !== year || cur.getMonth() !== month) continue;
      const key = toKey(cur);
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push({ label, color: EVENT_COLOR_APPROVED });
    }
  });

  const prevMonth = nav.prev;
  const nextMonth = nav.next;
  const goToday = nav.goToday;

  const toggleTeam = (t) => setTeams((prev) => ({ ...prev, [t]: !prev[t] }));

  return (

      <div className="space-y-6">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <Link
            to="/admin/leave-management"
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("common.leaveManagement")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">{t("calendar.breadcrumb")}</span>
        </div>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("calendar.title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("calendar.subtitle", { month: t(MONTH_KEYS[month]), year })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {/* Month/Week Toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm font-medium">
              {["Month", "Week"].map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-4 py-2 transition-colors ${viewMode === v ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  {v === "Month" ? t("calendar.viewMode.month") : t("calendar.viewMode.week")}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
              <MdOutlineFilterList className="text-base" /> {t("calendar.filters")}
            </button>
            {!lock.locked && (
              <Link
                to="/admin/leave-management/apply-leave"
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <MdOutlineAdd className="text-lg" /> {t("calendar.recordLeave")}
              </Link>
            )}
          </div>
        </div>

        {/* ── Calendar + Sidebar ── */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* Calendar Panel */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden min-w-0">
            {/* Calendar Nav */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={prevMonth}
                  disabled={!nav.canPrev}
                  className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MdOutlineChevronLeft className="rtl:rotate-180" />
                </button>
                <h2 className="text-lg font-bold text-gray-900 min-w-[130px] text-center">
                  {t(MONTH_KEYS[month])} <Ltr>{year}</Ltr>
                </h2>
                <button
                  onClick={nextMonth}
                  disabled={!nav.canNext}
                  className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MdOutlineChevronRight className="rtl:rotate-180" />
                </button>
                <button
                  onClick={goToday}
                  className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors px-2"
                >
                  {t("common.today")}
                </button>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  {t("calendar.legend.approved")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  {t("calendar.legend.pending")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  {t("calendar.legend.conflict")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  {t("calendar.legend.holiday")}
                </span>
              </div>
            </div>
            <CalendarGrid
              year={year}
              month={month}
              holidaysByDate={holidaysByDate}
              eventsByDate={eventsByDate}
            />
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-4">
            {/* Quick Filters */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4">
                {t("calendar.quickFilters")}
              </h3>

              <div className="mb-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t("calendar.project")}
                </label>
                <div className="relative">
                  <CustomDropdown
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    options={[
                      { label: t("calendar.projects.all"), value: "All Projects" },
                      { label: t("calendar.projects.fintech"), value: "Fintech Core v2" },
                      { label: t("calendar.projects.cloud"), value: "Cloud Migration" },
                      { label: t("calendar.projects.alpha"), value: "Project Alpha" }
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t("calendar.team")}
                </label>
                <div className="space-y-2">
                  {Object.entries(teams).map(([team, checked]) => (
                    <label
                      key={team}
                      onClick={() => toggleTeam(team)}
                      className="flex items-center gap-2.5 cursor-pointer group"
                    >
                      {checked ? (
                        <MdCheckBox className="text-cyan-600 text-xl flex-shrink-0" />
                      ) : (
                        <MdCheckBoxOutlineBlank className="text-gray-300 text-xl flex-shrink-0 group-hover:text-gray-400" />
                      )}
                      <span
                        className={`text-sm ${checked ? "text-gray-800 font-medium" : "text-gray-400"}`}
                      >
                        {t(`calendar.teams.${team.toLowerCase()}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>



            {/* Recent Requests */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4">
                {t("calendar.recentRequests", "Recent Requests")}
              </h3>
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                  <p className="text-xs text-gray-500 text-center py-4">{t("common.loading", "Loading...")}</p>
                ) : recentRequestsData.length > 0 ? (
                  recentRequestsData.map((req) => (
                    <div key={req.id} className="flex items-start gap-3">
                      {req.profile_url ? (
                        <img
                          src={req.profile_url}
                          alt={req.employee_name || t("calendar.employeeAlt")}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {req.employee_name ? req.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'NA'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                          {req.employee_name || t("calendar.unknownEmployee")}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {req.leave_type || t("myCalendar.leaveFallback")} • {req.total_days === 1 ? t("calendar.dayCountOne", { days: req.total_days }) : t("calendar.dayCountMany", { days: req.total_days })}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold flex-shrink-0 ${
                          req.status === 'APPROVED' ? 'text-green-600' :
                          req.status === 'REJECTED' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}
                      >
                        {req.status ? t(`statusCode.${req.status}`, { defaultValue: req.status }) : req.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-4">{t("common.noData", "No recent requests found.")}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Employee Balances Table ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">{t("calendar.employeeBalances", "Employee Balances")}</h3>
            {fy.label && (
              <span className="text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-md px-2 py-0.5 w-fit">
                {fy.label}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100 font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4 w-16">{t("calendar.balanceTable.sn")}</th>
                  <th className="px-5 py-4">{t("calendar.balanceTable.employee")}</th>
                  <th className="px-5 py-4 text-center">{t("calendar.balanceTable.allocated")}</th>
                  <th className="px-5 py-4 text-center">{t("calendar.balanceTable.used")}</th>
                  <th className="px-5 py-4 text-center">{t("calendar.balanceTable.remaining")}</th>
                  <th className="px-5 py-4 w-40 text-center">{t("calendar.balanceTable.status")}</th>
                  <th className="px-5 py-4 w-20 text-center">{t("calendar.balanceTable.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {balancesArray.length > 0 ? (
                  balancesArray.map((row, index) => {
                    const isExpanded = expandedEmployeeId === row.employee.id;
                    const totalAllocated = row.total_allocated || 0;
                    const totalRemaining = row.total_available_balance || 0;
                    const usedPercentage = totalAllocated > 0 ? ((row.total_consumed || 0) / totalAllocated) * 100 : 0;
                    return (
                      <React.Fragment key={row.employee.id}>
                        <tr className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4">{(balancePage - 1) * 10 + index + 1}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {row.employee.profile_url ? (
                                <img src={row.employee.profile_url} alt={row.employee.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                  {row.employee.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-gray-900">{row.employee.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center font-medium text-gray-700">{totalAllocated.toFixed(1)}</td>
                          <td className="px-5 py-4 text-center font-medium text-gray-700">{row.total_consumed.toFixed(1)}</td>
                          <td className="px-5 py-4 text-center font-bold text-cyan-600">{totalRemaining.toFixed(1)}</td>
                          <td className="px-5 py-4">
                             <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(usedPercentage, 100)}%` }}></div>
                             </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => toggleExpand(row.employee.id)}
                              className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                            >
                              {isExpanded ? <MdOutlineVisibilityOff className="text-lg" /> : <MdOutlineVisibility className="text-lg" />}
                            </button>
                          </td>
                        </tr>
                        <tr className="p-0 m-0 border-0">
                          <td colSpan={7} className="p-0 border-0">
                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                              <div className="overflow-hidden">
                                <div className="pl-16 pr-5 py-4 border-b border-gray-100 bg-gray-50/50">
                                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">{t("calendar.leaveBreakdown")}</h4>
                                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="w-full text-sm text-left text-gray-500 bg-white">
                                      <thead className="text-[10px] text-gray-400 uppercase bg-gray-50 border-b border-gray-200 font-bold tracking-wider">
                                        <tr>
                                          <th className="px-4 py-3">{t("calendar.balanceTable.leaveType")}</th>
                                          <th className="px-4 py-3 text-center">{t("calendar.balanceTable.allocated")}</th>
                                          <th className="px-4 py-3 text-center">{t("calendar.balanceTable.used")}</th>
                                          <th className="px-4 py-3 text-center">{t("calendar.balanceTable.remaining")}</th>
                                          <th className="px-4 py-3 text-end">{t("calendar.balanceTable.action")}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {row.leave_balances.map(lb => (
                                          <tr key={lb.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                              <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-1 rounded">{lb.name}</span>
                                              <CarriedLeaveNote balance={{ ...lb, balance_year: balanceYear }} className="mt-1.5" />
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{lb.allocated}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{lb.used}</td>
                                            <td className="px-4 py-3 text-center font-bold text-cyan-600">{lb.balance}</td>
                                            <td className="px-4 py-3 text-end">
                                              <Can module={MODULES.LEAVE} action={ACTIONS.UPDATE}>
                                                <button
                                                  type="button"
                                                  onClick={() => setAdjusting({ balance: { ...lb, balance_year: balanceYear }, employeeName: row.employee.name })}
                                                  disabled={lock.locked || !lb.balance_id || lb.balance_status === "CLOSED"}
                                                  title={
                                                    lock.locked
                                                      ? lock.title
                                                      : !lb.balance_id
                                                        ? t("fy.adjust.noRow")
                                                        : lb.balance_status === "CLOSED"
                                                          ? t("fy.adjust.closedRow")
                                                          : t("fy.adjust.button")
                                                  }
                                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-cyan-700 border border-cyan-200 rounded-lg hover:bg-cyan-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                  <MdOutlineTune className="text-sm" /> {t("fy.adjust.button")}
                                                </button>
                                              </Can>
                                            </td>
                                          </tr>
                                        ))}
                                        {row.leave_balances.length === 0 && (
                                          <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                                              {t("calendar.noLeavePolicies")}
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                      {t("calendar.noEmployeeBalances")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={balancePage}
            totalPages={balancesTotalPages}
            total={balancesTotalCount}
            limit={10}
            onPage={setBalancePage}
            label={t("calendar.paginationLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
          />
        </div>

        <AdjustLeaveBalanceModal
          open={!!adjusting}
          balance={adjusting?.balance}
          employeeName={adjusting?.employeeName}
          onClose={() => setAdjusting(null)}
          onDone={(updated) => {
            setAdjusting(null);
            applyAdjusted(updated);
          }}
        />
      </div>

  );
}

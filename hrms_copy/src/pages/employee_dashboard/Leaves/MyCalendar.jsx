import { useState, useMemo } from "react";
import {
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
  MdOutlineWarning,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
} from "react-icons/md";

import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import Ltr from "../../../components/Ltr";
import { HOLIDAYS, MY_LEAVES } from "../../../data/groupH";
import CustomDropdown from "../../../components/CustomDropdown";
import useFyMonthNav from "../../../hooks/useFyMonthNav";

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

// Helpers for dates
const getDatesBetween = (startStr, endStr) => {
  const dates = [];
  if (!startStr || !endStr) return dates;
  let curr = new Date(startStr);
  const end = new Date(endStr);
  while (curr <= end) {
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, "0");
    const day = String(curr.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

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
              const events = cell.dateKey
                ? eventsByDate[cell.dateKey] || []
                : [];
              const holidayNames = cell.dateKey
                ? holidaysByDate[cell.dateKey] || []
                : [];
              return (
                <div
                  key={ci}
                  className={`min-h-[80px] p-2 border-e border-gray-100 last:border-e-0 transition-colors hover:bg-gray-50/50 ${
                    !cell.current ? "bg-gray-50/30" : ""
                  } ${holidayNames.length ? "bg-blue-50/40" : ""}`}
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
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate leading-tight bg-blue-100 text-blue-700 border-s-2 border-blue-400"
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
export default function MyCalendar() {
  const { t } = useTranslation("leaves");
  // Calendar month: inside the selected financial year, reset on year change.
  const nav = useFyMonthNav();
  const { year, month } = nav;
  const [teams, setTeams] = useState({
    Engineering: true,
    Design: true,
    Product: false,
  });
  const [projectFilter, setProjectFilter] = useState("All Projects");
  // The whole static list: the grid only shows the dates of its own month.
  const holidaysByDate = useMemo(() => {
    const map = {};
    const holidaysData = HOLIDAYS;
    holidaysData.forEach((h) => {
      if (!h.holiday_date) return;
      const key = String(h.holiday_date).slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(h.holiday_name);
    });
    return map;
  }, []);

  const eventsByDate = useMemo(() => {
    const map = {};
    const leaveData = MY_LEAVES;
    leaveData.forEach((req) => {
      const dates = getDatesBetween(req.from_date, req.to_date);
      let color = "bg-gray-100 text-gray-700 border-s-2 border-gray-500";
      if (req.status?.toUpperCase() === "APPROVED") {
        color = "bg-green-100 text-green-700 border-s-2 border-green-500";
      } else if (req.status?.toUpperCase() === "PENDING") {
        color = "bg-amber-100 text-amber-700 border-s-2 border-amber-400";
      } else if (req.status?.toUpperCase() === "REJECTED") {
        color = "bg-red-100 text-red-700 border-s-2 border-red-500";
      }

      dates.forEach((date) => {
        if (!map[date]) map[date] = [];
        const statusText = req.status
          ? t(`status.${req.status.toLowerCase()}`)
          : req.status;
        map[date].push({
          label: `${req.leave_type?.leave_name || req.leave_type || t("myCalendar.leaveFallback")} (${statusText})`,
          color,
        });
      });
    });
    return map;
  }, [t]);

  const prevMonth = nav.prev;
  const nextMonth = nav.next;
  const goToday = nav.goToday;

  const toggleTeam = (t) => setTeams((prev) => ({ ...prev, [t]: !prev[t] }));

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <Link
          to="/employee/dashboard"
          className="text-gray-400 hover:text-cyan-600 transition-colors"
        >
          {t("myCalendar.breadcrumbEmployee")}
        </Link>
        <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
        <span className="text-cyan-600 font-semibold">{t("myCalendar.breadcrumbCalendar")}</span>
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("myCalendar.title")}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {t("myCalendar.subtitle", { month: t(MONTH_KEYS[month]), year })}
          </p>
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
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
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

          {/* Conflict Warning */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MdOutlineWarning className="text-red-500 text-lg flex-shrink-0" />
              <p className="text-sm font-bold text-red-600">{t("calendar.conflictWarning")}</p>
            </div>
            <p className="text-xs text-red-500 leading-relaxed mb-4">
              <Trans
                i18nKey="calendar.conflictBody"
                ns="leaves"
                components={[<strong className="text-red-600" />]}
              />
            </p>
            <button className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-xs font-bold transition-colors">
              {t("calendar.resolveConflict")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

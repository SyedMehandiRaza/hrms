import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MdAccessTime,
  MdOutlineCalendarToday,
  MdCheckCircleOutline,
  MdOutlineDescription,
  MdOutlineEventBusy,
  MdOutlineFlight,
  MdInfoOutline,
  MdOutlineMedicalServices,
  MdOutlineWarning,
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
} from "react-icons/md";
import Ltr from "./Ltr";
import AttendanceDetailModal from "./AttendanceDetailModal";
import { getEmployeeRecord, attendanceMonthLog, recentLeaveRequests } from "../data/groupB";
import useFiscalYear from "../hooks/useFiscalYear";
import { useFormat } from "../hooks/useFormat";

// "YYYY-MM" → "October 2026" (in the UI language, via useFormat's fmtDate)
const formatMonthYear = (ym, fmtDate) => {
  const [y, m] = String(ym).split("-").map(Number);
  return fmtDate(new Date(y, m - 1, 1), { month: "long", year: "numeric" });
};

const formatRowDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const formatWeekday = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long" });
};

const formatTime = (isoString) => {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const STATUS_STYLES = {
  PRESENT: "text-green-700 bg-green-50 border-green-200",
  LEAVE: "text-blue-700 bg-blue-50 border-blue-200",
  ABSENT: "text-red-700 bg-red-50 border-red-200",
  INCOMPLETE: "text-amber-700 bg-amber-50 border-amber-200",
  WEEKLY_OFF: "text-gray-700 bg-gray-50 border-gray-200",
  HOLIDAY: "text-purple-700 bg-purple-50 border-purple-200",
  FUTURE: "text-gray-400 bg-gray-50 border-gray-200",
  NA: "text-gray-400 bg-gray-50 border-gray-200",
  OP: "text-slate-600 bg-slate-100 border-slate-200",
};

const STATUS_DOT = {
  PRESENT: "bg-green-500",
  LEAVE: "bg-blue-400",
  ABSENT: "bg-red-500",
  INCOMPLETE: "bg-amber-500",
  WEEKLY_OFF: "bg-gray-500",
  HOLIDAY: "bg-purple-500",
  FUTURE: "bg-gray-300",
  NA: "bg-gray-300",
  OP: "bg-slate-400",
};

// ── Attendance Tab ─────────────────────────────────────────────────────────────
function AttendanceTab({ employeeId }) {
  const { t } = useTranslation("employees");
  const employee = getEmployeeRecord(employeeId);
  const [page, setPage] = useState(1);
  const loading = false;
  const [selectedDayStr, setSelectedDayStr] = useState(null);

  // Selected month ("YYYY-MM") — inside the financial year chosen in the header.
  const fy = useFiscalYear();
  const { fmtDate } = useFormat();
  const [month, setMonth] = useState(fy.defaultMonth);
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setMonth(fy.defaultMonth);
    setPage(1);
  }
  const monthIdx = fy.months.findIndex((m) => m.value === month);
  const canPrevMonth = monthIdx > 0;
  const canNextMonth = monthIdx >= 0 && monthIdx < fy.months.length - 1;

  const PAGE_SIZE = 10;

  const statusLabel = (s) => {
    const key = String(s).toLowerCase().replace("_", "");
    // Fallback if translation doesn't exist
    return t(`attendance.status.${key}`, s);
  };

  // Static month log + summary for the selected month (paged client-side).
  const monthData = useMemo(() => attendanceMonthLog(employeeId, month), [employeeId, month]);
  const fullLog = monthData.log;
  const summaryData = monthData.summary;
  const total = fullLog.length;
  const logData = fullLog.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const leaveRequests = useMemo(() => recentLeaveRequests(employeeId), [employeeId]);

  // Month steps stay inside the selected financial year.
  const stepMonth = (dir) => {
    const next = fy.months[monthIdx + dir];
    if (!next) return;
    setMonth(next.value);
    setPage(1);
  };
  const handlePrevMonth = () => stepMonth(-1);
  const handleNextMonth = () => stepMonth(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(page * PAGE_SIZE, total);

  const visiblePages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
      }
    }
    return pages;
  };

  const paginatedLog = logData;

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            tag: t("attendance.averageHours"),
            icon: MdAccessTime,
            iconBg: "bg-cyan-50",
            iconColor: "text-cyan-500",
            value: summaryData ? `${summaryData.worked_hours}h` : "—",
            sub: (
              <span className="text-xs text-gray-400">
                {t("attendance.averageHoursSub", { hours: summaryData?.hours_per_day || 8 })}
              </span>
            ),
          },
          {
            tag: t("attendance.presentDays"),
            icon: MdCheckCircleOutline,
            iconBg: "bg-green-50",
            iconColor: "text-green-500",
            value: summaryData ? summaryData.present_days : "—",
            sub: (
              <span className="text-xs text-gray-400">
                {t("attendance.presentDaysSub", { total: summaryData?.working_days || 0 })}
              </span>
            ),
          },
          {
            tag: t("attendance.totalLeaves"),
            icon: MdOutlineEventBusy,
            iconBg: "bg-purple-50",
            iconColor: "text-purple-500",
            value: summaryData ? summaryData.total_leave_days : "—",
            sub: <span className="text-xs text-gray-400">{t("attendance.thisMonth")}</span>,
          },
          {
            tag: t("attendance.lateness"),
            icon: MdAccessTime,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-500",
            value: summaryData ? summaryData.late_days : "—",
            sub: summaryData && summaryData.late_days > 0 ? (
              <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                <MdOutlineWarning className="text-sm" />
                {t("attendance.actionRequired")}
              </span>
            ) : null,
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.tag}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {c.tag}
                </p>
                <div
                  className={`w-7 h-7 ${c.iconBg} rounded-lg flex items-center justify-center`}
                >
                  <Icon className={`${c.iconColor} text-base`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-0.5">
                {c.value}
              </p>
              {c.sub}
            </div>
          );
        })}
      </div>

      {/* Attendance Log */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {t("attendance.attendanceLog")}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {t("attendance.attendanceLogSub")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handlePrevMonth}
              disabled={!canPrevMonth}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <MdOutlineChevronLeft className="text-xl rtl:rotate-180" />
            </button>
            <button className="flex items-center justify-center gap-2 border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors min-w-[120px]">
              <MdOutlineCalendarToday className="text-gray-400 text-base" />
              <span>{formatMonthYear(month, fmtDate)}</span>
            </button>
            <button
              onClick={handleNextMonth}
              disabled={!canNextMonth}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <MdOutlineChevronRight className="text-xl rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  t("attendance.table.sn"),
                  t("attendance.table.date"),
                  t("attendance.table.checkIn"),
                  t("attendance.table.checkOut"),
                  t("attendance.table.totalHours"),
                  t("attendance.table.status"),
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
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-400">
                    {t("attendance.loading")}
                  </td>
                </tr>
              ) : paginatedLog.map((row, index) => (
                <tr
                  key={row.date}
                  onClick={() => setSelectedDayStr(row.date)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {(page - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900">
                      <Ltr>{formatRowDate(row.date)}</Ltr>
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {formatWeekday(row.date)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    <Ltr>{row.check_in_time ? formatTime(row.check_in_time) : "—"}</Ltr>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    <Ltr>{row.check_out_time ? formatTime(row.check_out_time) : "—"}</Ltr>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-900">
                    <Ltr>{row.total_minutes > 0 ? `${Math.floor(row.total_minutes / 60)}h ${row.total_minutes % 60}m` : "—"}</Ltr>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[row.status] || STATUS_STYLES.FUTURE}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[row.status] || STATUS_DOT.FUTURE}`}
                      />
                      {statusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && paginatedLog.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-400">
                    {t("attendance.noRecords")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {!loading && paginatedLog.map((row) => (
            <div key={row.date} className="px-4 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    <Ltr>{formatRowDate(row.date)}</Ltr>
                  </p>
                  <p className="text-xs text-gray-400 capitalize">
                    {formatWeekday(row.date)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${STATUS_STYLES[row.status] || STATUS_STYLES.FUTURE}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[row.status] || STATUS_DOT.FUTURE}`}
                  />
                  {statusLabel(row.status)}
                </span>
              </div>
              {row.check_in_time && (
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>
                    {t("attendance.in")}{" "}
                    <strong className="text-gray-800">
                      <Ltr>{formatTime(row.check_in_time)}</Ltr>
                    </strong>
                  </span>
                  <span>
                    {t("attendance.out")}{" "}
                    <strong className="text-gray-800">
                      <Ltr>{row.check_out_time ? formatTime(row.check_out_time) : "—"}</Ltr>
                    </strong>
                  </span>
                  <span>
                    {t("attendance.total")}{" "}
                    <strong className="text-gray-800">
                      <Ltr>{row.total_minutes > 0 ? `${Math.floor(row.total_minutes / 60)}h ${row.total_minutes % 60}m` : "—"}</Ltr>
                    </strong>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-100">
          <span className="text-sm text-gray-400 order-2 sm:order-1">
            Showing{" "}
            <span className="font-semibold text-gray-600">
              {startIdx}–{endIdx}
            </span>{" "}
            of <span className="font-semibold text-gray-600">{total}</span>{" "}
            entries
          </span>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <MdOutlineChevronLeft className="rtl:rotate-180" />
            </button>
            {visiblePages().map((n, i) =>
              n === "..." ? (
                <span key={`dots-${i}`} className="px-2 py-1 text-gray-400">...</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    page === n
                      ? "bg-cyan-500 text-white border-transparent"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <MdOutlineChevronRight className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: Rules + Leave Requests */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Attendance Rules */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MdInfoOutline className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">
              {t("attendance.rulesTitle")}
            </h3>
          </div>
          <div className="space-y-4">
            {[
              {
                icon: MdOutlineWarning,
                iconBg: "bg-amber-50",
                iconColor: "text-amber-500",
                title: t("attendance.rules.lateTitle"),
                desc: t("attendance.rules.lateDesc"),
              },
              {
                icon: MdOutlineDescription,
                iconBg: "bg-cyan-50",
                iconColor: "text-cyan-500",
                title: t("attendance.rules.hoursTitle"),
                desc: t("attendance.rules.hoursDesc"),
              },
            ].map(({ icon: Icon, iconBg, iconColor, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  <Icon className={`${iconColor} text-base`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-0.5">
                    {title}
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Leave Requests */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">
              {t("attendance.recentLeaveRequests")}
            </h3>
            <button className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
              {t("attendance.viewAll")}
            </button>
          </div>
          <div className="space-y-4">
            {!Array.isArray(leaveRequests) || leaveRequests.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t("attendance.noRecentLeaves")}</p>
            ) : (
              leaveRequests.map((req) => {
                const Icon = req.leave_type?.toLowerCase().includes("medical") ? MdOutlineMedicalServices : MdOutlineFlight;
                const iconBg = req.leave_type?.toLowerCase().includes("medical") ? "bg-cyan-50" : "bg-orange-50";
                const iconColor = req.leave_type?.toLowerCase().includes("medical") ? "text-cyan-500" : "text-orange-500";

                return (
                  <div key={req.id} className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`${iconColor} text-lg`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">
                        {req.leave_type || t("attendance.leaveRequestFallback")}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {req.reason || t("attendance.noReason")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {req.total_days} {req.total_days === 1 ? 'Day' : 'Days'}
                      </p>
                      <span className="text-[10px] font-semibold text-gray-500 uppercase">{req.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <AttendanceDetailModal
        isOpen={!!selectedDayStr}
        onClose={() => setSelectedDayStr(null)}
        employee={{
          ...employee,
          days: Object.fromEntries(fullLog.map(d => [parseInt(d.date.split("-")[2]), d.status]))
        }}
        date={selectedDayStr}
        loading={loading}
        dayData={fullLog.find(d => d.date === selectedDayStr)}
        viewMode="monthly"
        currentMonth={month}
        onDayClick={setSelectedDayStr}
        onShiftMonth={stepMonth}
      />
    </div>
  );
}

export default AttendanceTab;

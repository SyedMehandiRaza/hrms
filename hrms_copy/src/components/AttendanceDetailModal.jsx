import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormat } from "../hooks/useFormat";
import { MdClose, MdOutlineChevronLeft, MdOutlineChevronRight } from "react-icons/md";
import Ltr from "./Ltr";
import useFiscalYear from "../hooks/useFiscalYear";

// Formatter helpers
const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "--";

const fmtHours = (h) => {
  if (h == null) return "0h 00m";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
};

const DOT_COLORS = {
  PRESENT: "bg-green-500",
  INCOMPLETE: "bg-amber-500",
  ABSENT: "bg-red-500",
  WEEKLY_OFF: "bg-gray-300",
  HOLIDAY: "bg-purple-500",
  LEAVE: "bg-blue-500",
  FUTURE: "bg-gray-200"
};

// Flatten sessions → ordered Check In / Check Out timeline events
const buildTimeline = (sessions = []) => {
  const events = [];
  sessions.forEach((s) => {
    events.push({ label: "Check In", time: s.check_in_time, project: s.project_name });
    events.push({
      label: "Check Out",
      time: s.check_out_time,
      missing: !s.check_out_time,
    });
  });
  return events;
};

export default function AttendanceDetailModal({
  isOpen,
  onClose,
  employee,
  date,
  loading,
  dayData,
  viewMode = "daily",
  currentMonth,
  onDayClick,
  onShiftMonth,
}) {
  const { t } = useTranslation("attendance");
  const { fmtDate } = useFormat();
  const fy = useFiscalYear();
  const [show, setShow] = useState(false);
  const eventLabel = (ev) => (ev.label === "Check In" ? t("dayModal.checkIn") : t("dayModal.checkOut"));

  useEffect(() => {
    let timeoutId;
    if (isOpen) timeoutId = setTimeout(() => setShow(true), 10);
    else setShow(false);
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen && !show) return null;

  const name = dayData?.employee?.full_name || employee?.full_name || t("dayModal.employeeFallback");
  const code = dayData?.employee?.country_emp_id || employee?.country_emp_id || "";
  const shift = dayData?.employee?.shift || employee?.shift || null;
  const status = dayData?.status;
  const sessions = dayData?.sessions || [];
  const timeline = buildTimeline(sessions);

  // ───────────────────────────────────────────────────────────────────────────
  // Daily Mode UI
  // ───────────────────────────────────────────────────────────────────────────
  const renderDaily = () => (
    <>
      <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-[#f8f9fc] shrink-0">
        <h2 className="text-lg font-bold text-gray-900">{t("dayModal.employeeDetails")}</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
        >
          <MdClose size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8f9fc] px-5 py-6">
        <div className="space-y-8">
          {/* Employee Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-100 text-cyan-700 font-bold text-xl flex items-center justify-center shadow-sm shrink-0 border border-cyan-200/50">
              {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 leading-tight">{name}</h3>
              <p className="text-sm text-gray-500 mt-1">{employee?.designation || t("dayModal.designationFallback")}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#f0f4fb] p-4 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{t("dayModal.totalSessions")}</p>
              <p className="text-xl font-bold text-gray-900">{sessions.length || 0}</p>
            </div>
            <div className="bg-[#f0f4fb] p-4 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{t("dayModal.workHours")}</p>
              <p className="text-xl font-bold text-gray-900">{fmtHours(dayData?.total_hours)}</p>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-5">{t("dayModal.sessionTimeline")}</h4>
            {loading ? (
              <div className="py-6 text-center text-sm text-gray-400">{t("common.loadingEllipsis")}</div>
            ) : timeline.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">{t("dayModal.noCheckInRecords")}</div>
            ) : (
              <div className="relative ps-3 space-y-5">
                <div className="absolute top-4 bottom-4 start-[17px] w-0.5 bg-gray-200" />
                {timeline.map((ev, i) => (
                  <div key={i} className="relative flex items-center gap-5">
                    <div
                      className={`w-3.5 h-3.5 rounded-full z-10 outline outline-[4px] outline-[#f8f9fc] ${ev.label === "Check In" ? "bg-cyan-500" : ev.missing ? "bg-red-400" : "bg-[#545e6f]"}`}
                    />
                    <div className={`flex-1 border rounded-xl p-3.5 flex justify-between items-center shadow-sm ${ev.missing ? "border-dashed border-red-300 bg-red-50" : "bg-white border-gray-200"}`}>
                      <span className="font-bold text-[13px] text-gray-900">{eventLabel(ev)}</span>
                      <span className="text-[12px] font-bold text-gray-600">
                        {ev.missing ? t("dayModal.missing") : <Ltr>{fmtTime(ev.time)}</Ltr>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {status === 'PRESENT' && timeline.length > 0 && (
            <div className="bg-[#eef2f6] p-4 rounded-xl text-xs font-medium text-gray-600 italic border border-gray-200">
              {t("dayModal.routineNote")}
            </div>
          )}
        </div>
      </div>
    </>
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Monthly Mode UI
  // ───────────────────────────────────────────────────────────────────────────
  const renderMonthly = () => {
    // Generate calendar based on currentMonth (YYYY-MM)
    const [y, m] = (currentMonth || fy.defaultMonth).split("-").map(Number);
    // Month steps stay inside the selected financial year.
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const canPrev = !fy.range || ym > fy.range.from.slice(0, 7);
    const canNext = !fy.range || ym < fy.range.to.slice(0, 7);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDay = new Date(y, m - 1, 1).getDay(); // 0 (Sun) to 6 (Sat)

    // Shift so Monday is 0
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const monthLabel = fmtDate(new Date(y, m - 1, 1), { month: "long", year: "numeric" });
    const todayLabel = date ? fmtDate(date, { month: "short", day: "numeric" }).toUpperCase() : t("dayModal.selectedDay");

    const blanks = Array.from({ length: startOffset });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-[#f8f9fc] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t("dayModal.attendanceLog")}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t("dayModal.detailedViewFor", { month: monthLabel })}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            <MdClose size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-5">
          <div className="space-y-8">
            {/* Employee Card */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#f8f9fc] border border-gray-100 shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#d4ede5] to-[#f1f9f6] text-gray-800 font-bold text-xl flex items-center justify-center border border-gray-200 shrink-0">
                {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-gray-900 leading-tight">{name}</h3>
                <p className="text-[11px] font-semibold text-gray-500 mt-1 mb-2">
                  {employee?.designation || t("dayModal.designationFallback")} • {t("dayModal.idLabel")} <Ltr>{code}</Ltr>
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider text-green-700 bg-green-100">{t("dayModal.active")}</span>
                  {shift && <span className="text-[10px] font-medium text-gray-500">{t("dayModal.shift")} {shift.name} {shift.start_time ? `(${shift.start_time.slice(0, 5)} - ${shift.end_time?.slice(0, 5) || ''})` : ''}</span>}
                </div>
              </div>
            </div>

            {/* Monthly Snapshot */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{t("dayModal.monthlySnapshot")}</h4>
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase">
                  <MdOutlineChevronLeft
                    className={`text-sm rtl:rotate-180 ${canPrev ? "cursor-pointer hover:text-gray-700" : "opacity-30 cursor-not-allowed"}`}
                    onClick={() => { if (canPrev && onShiftMonth) onShiftMonth(-1); }}
                  />
                  <span className="mx-1">{fmtDate(new Date(y, m - 1, 1), { month: "long" }).toUpperCase()}</span>
                  <MdOutlineChevronRight
                    className={`text-sm rtl:rotate-180 ${canNext ? "cursor-pointer hover:text-gray-700" : "opacity-30 cursor-not-allowed"}`}
                    onClick={() => { if (canNext && onShiftMonth) onShiftMonth(1); }}
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                  {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((k) => t(`dayModal.weekdayInitials.${k}`)).map((d, i) => (
                    <div key={i} className="text-[10px] font-bold text-gray-400">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 gap-y-3 text-center">
                  {blanks.map((_, i) => (
                    <div key={`b-${i}`} className="h-10" />
                  ))}
                  {days.map(d => {
                    // Check status for this day from employee.days
                    const dayStatus = employee?.days?.[d] || 'FUTURE';
                    const isSelected = date === `${currentMonth}-${String(d).padStart(2, '0')}`;
                    const dotColor = DOT_COLORS[dayStatus] || "bg-gray-200";

                    return (
                      <div
                        key={d}
                        className="flex flex-col items-center justify-center group cursor-pointer transition-transform hover:scale-105"
                        onClick={() => { if (onDayClick) onDayClick(`${currentMonth}-${String(d).padStart(2, '0')}`); }}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${isSelected ? 'bg-[#18a0a9] text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}>
                          {d}
                        </div>
                        <div className={`w-1 h-1 rounded-full mt-1.5 ${dotColor}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Today's Log */}
            <div>
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-5">{t("dayModal.todaysLog", { date: todayLabel })}</h4>
              {loading ? (
                <div className="py-6 text-center text-sm text-gray-400">{t("common.loadingEllipsis")}</div>
              ) : timeline.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">{t("dayModal.noRecords")}</div>
              ) : (
                <div className="relative ps-3 space-y-5">
                  <div className="absolute top-4 bottom-4 start-[17px] w-0.5 bg-gray-100" />
                  {timeline.map((ev, i) => (
                    <div key={i} className="relative flex items-center gap-5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full z-10 outline outline-[4px] outline-white ${ev.label === "Check In" ? "bg-[#18a0a9]" : ev.missing ? "bg-red-400" : "bg-[#545e6f]"}`}
                      />
                      <div className={`flex-1 border rounded-xl p-3.5 flex justify-between items-center shadow-sm ${ev.missing ? "border-dashed border-red-300 bg-red-50/40" : "bg-[#f8f9fc] border-gray-100"}`}>
                        <span className="font-bold text-[13px] text-gray-900">{eventLabel(ev)}</span>
                        <span className="text-[12px] font-bold text-gray-700">
                          {ev.missing ? t("dayModal.missing") : <Ltr>{fmtTime(ev.time)}</Ltr>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 p-5 bg-white border-t border-gray-100">
          <div className="bg-[#eef2f6] rounded-xl p-4 flex items-center justify-between border border-[#e2e8f0]">
            <div>
              <p className="text-[10px] font-bold text-[#18a0a9] tracking-wider mb-1 uppercase">
                {t("dayModal.totalWorkingHours")}
              </p>
              <p className="text-xl font-bold text-[#18a0a9] leading-none">
                <Ltr>{fmtHours(dayData?.total_hours)}</Ltr>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-[200] transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 end-0 z-[210] w-full max-w-[420px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${show ? "translate-x-0 rtl:-translate-x-0" : "translate-x-full rtl:-translate-x-full"}`}
      >
        {viewMode === 'monthly' ? renderMonthly() : renderDaily()}
      </div>
    </>
  );
}

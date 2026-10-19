import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
  MdOutlineInfo,
} from "react-icons/md";
import { getShiftById, saveShift } from "../../data/groupC";
import FieldError from "../../components/FieldError";
import Ltr from "../../components/Ltr";
import YearStatusBadge from "../../components/fiscalYear/YearStatusBadge";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import { useFormat } from "../../hooks/useFormat";
import { fyLabel, monthsOfFy, yearKeyFor } from "../../utils/fiscalYear";
import { shiftNameRules, shiftEffectiveFromRule } from "../../utils/fyValidation/ops-time";

// "HH:mm" and "HH:mm:ss" compare equal.
const hms = (v) => (v ? (String(v).length === 5 ? `${v}:00` : String(v)) : "");
const fmtTimeShort = (v) => (v ? String(v).slice(0, 5) : "—");

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const WEEKDAY_INITIALS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const pad = (n) => String(n).padStart(2, "0");
const daysIn = (year, month) => new Date(year, month, 0).getDate(); // month 1–12
const weekdayOf = (year, month, day) => new Date(year, month - 1, day).getDay();

export default function AddShift() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const fy = useFiscalYear();
  const lock = useYearLock();
  const { fmtDate } = useFormat();

  // Edit mode → the shift comes from the static store; prefill name/time + its
  // off-day calendar. The time inputs take "HH:mm"; the store keeps "HH:mm:ss".
  const [loadedShift] = useState(() => (isEdit ? getShiftById(id) : null));
  const hhmm = (v) => (v ? String(v).slice(0, 5) : "");

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: loadedShift
      ? {
          name: loadedShift.name || "",
          start_time: hhmm(loadedShift.start_time),
          end_time: hhmm(loadedShift.end_time),
          effective_from: fy.today,
        }
      : {
          name: "",
          start_time: "",
          end_time: "",
          effective_from: "",
        }
  });

  // Edit mode: the timings in force today (to spot a change), and the
  // timing history (newest first) from GET /shifts/:id.
  const original = loadedShift ? { start_time: loadedShift.start_time, end_time: loadedShift.end_time } : null; // { start_time, end_time }
  const versions = Array.isArray(loadedShift?.versions) ? loadedShift.versions : [];
  const timingToday = loadedShift?.timing_today || null;

  const [saving, setSaving] = useState(false);
  // Error under the weekly-off calendar (server: weekly_off_days — e.g. a
  // change inside a closed period).
  const [offDaysError, setOffDaysError] = useState("");

  // The calendar shows one financial year (its 12 months in FY order). It opens
  // on the year chosen in the header and follows it when that changes.
  const initialFy = fy.selected ?? yearKeyFor(fy.startMonth, fy.today);
  const [viewFy, setViewFy] = useState(initialFy);
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setViewFy(initialFy);
  }

  const [isBulkSelectActive, setIsBulkSelectActive] = useState(false);
  const loadingShift = false;
  // Edit mode only: true once the shift (and its off-days) actually loaded.
  // Saving before that would send an empty calendar and wipe every off-day.
  const shiftLoaded = !isEdit || !!loadedShift?.id;

  // Set of formatted dates "YYYY-MM-DD"
  const [selectedOffDays, setSelectedOffDays] = useState(
    () => new Set(Array.isArray(loadedShift?.weekly_off_days) ? loadedShift.weekly_off_days : []),
  );

  // Editing an existing shift's start / end time → ask from which day.
  const watchStart = watch("start_time");
  const watchEnd = watch("end_time");
  const watchFrom = watch("effective_from");
  const timingChanged =
    isEdit &&
    !!original &&
    (hms(watchStart) !== hms(original.start_time) || hms(watchEnd) !== hms(original.end_time));
  const fromValue = watchFrom || fy.today;
  const isScheduled = timingChanged && fromValue > fy.today;
  // Earliest pick: the selected FY's first day (today when that year is locked).
  const minFrom = fy.range && !lock.locked ? fy.range.from : fy.today;
  const fromRule = shiftEffectiveFromRule(t, { today: fy.today, lock, years: fy.years });
  const longDate = (d) => fmtDate(d, { day: "2-digit", month: "short", year: "numeric" });
  // In force = the newest version that started on/before today.
  const inForceIdx = versions.findIndex((v) => v.effective_from <= fy.today);

  // ── The financial year on screen ──
  const yearKeys = fy.years.map((y) => y.year_key).sort((a, b) => a - b);
  const minFy = yearKeys.length ? yearKeys[0] : null;
  const maxFy = yearKeys.length ? yearKeys[yearKeys.length - 1] : null;
  const viewYear = fy.years.find((y) => y.year_key === viewFy) || null;
  const viewLabel = viewYear?.label || fyLabel(fy.startMonth, viewFy);
  const viewMonths = monthsOfFy(fy.startMonth, viewFy);
  const canPrevFy = minFy == null || viewFy > minFy;
  const canNextFy = maxFy == null || viewFy < maxFy;

  // A day can't be changed when it's in the past (the server keeps past
  // off-days as they were) or in a closed + locked year.
  const dayLocked = (dateStr) => dateStr < fy.today || lock.isLockedDate(dateStr);
  const dayTitle = (dateStr) =>
    lock.isLockedDate(dateStr)
      ? t("fiscalYear:locked.tooltip", { label: viewLabel })
      : dateStr < fy.today
        ? t("shift.add.pastDayHint")
        : undefined;

  const toggleDay = (formattedDate) => {
    if (dayLocked(formattedDate)) return;
    setOffDaysError("");
    setSelectedOffDays(prev => {
      const next = new Set(prev);

      if (isBulkSelectActive) {
        // The same weekday across the whole financial year on screen.
        const [y, m, d] = formattedDate.split("-").map(Number);
        const targetDayOfWeek = weekdayOf(y, m, d);
        const isCurrentlySelected = next.has(formattedDate);

        viewMonths.forEach(({ year, month }) => {
          for (let day = 1; day <= daysIn(year, month); day++) {
            if (weekdayOf(year, month, day) !== targetDayOfWeek) continue;
            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            if (dayLocked(dateStr)) continue;
            if (isCurrentlySelected) next.delete(dateStr);
            else next.add(dateStr);
          }
        });
      } else {
        if (next.has(formattedDate)) {
          next.delete(formattedDate);
        } else {
          next.add(formattedDate);
        }
      }
      return next;
    });
  };

  const onSubmit = async (data) => {
    // Never save an edit whose shift didn't load — it would erase the calendar.
    if (isEdit && !shiftLoaded) {
      toast.error(t("shift.add.loadFailed"));
      return;
    }
    setOffDaysError("");
    const payload = {
      name: data.name.trim(),
      start_time: data.start_time,
      end_time: data.end_time,
      weekly_off_days: Array.from(selectedOffDays).sort(),
    };
    // New timings apply from this day (blank → today, the server's default).
    if (timingChanged) payload.effective_from = data.effective_from || fy.today;

    setSaving(true);
    saveShift(isEdit ? id : null, payload);
    toast.success(isEdit ? t("shift.add.updated") : t("shift.add.created"));
    navigate("/admin/shift-management");
    setSaving(false);
  };

  const nameRules = shiftNameRules(t);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {isEdit ? t("shift.add.editTitle") : t("shift.add.addTitle")}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          {t("shift.add.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-white border border-gray-200 rounded-xl">
        <div className="p-4 md:p-6 space-y-8">
          {/* Top Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("shift.add.shiftName")}
              </label>
              <input
                type="text"
                maxLength={50}
                placeholder={t("shift.add.shiftNamePlaceholder")}
                {...register("name", {
                  required: t("shift.add.shiftNameRequired"),
                  validate: nameRules.validate,
                })}
                className={`w-full border bg-white rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.name ? "border-red-300" : "border-gray-200"}`}
              />
              <FieldError error={errors.name} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("shift.add.startTime")}
              </label>
              <input
                type="time"
                step="1"
                {...register("start_time", { required: t("shift.add.startTimeRequired") })}
                className={`w-full border bg-white rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.start_time ? "border-red-300" : "border-gray-200"}`}
              />
              <FieldError error={errors.start_time} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("shift.add.endTime")}
              </label>
              <input
                type="time"
                step="1"
                {...register("end_time", { required: t("shift.add.endTimeRequired") })}
                className={`w-full border bg-white rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.end_time ? "border-red-300" : "border-gray-200"}`}
              />
              <FieldError error={errors.end_time} />
            </div>
          </div>

          {/* Timing changes are effective-dated (hrms_shift_versions). */}
          {isEdit && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 -mt-2">
              <div className="lg:col-span-2 space-y-3">
                {timingChanged && (
                  <div className="max-w-xs">
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      {t("shift.add.effectiveFrom")}
                    </label>
                    <input
                      type="date"
                      min={minFrom}
                      {...register("effective_from", { validate: { rule: fromRule } })}
                      className={`w-full border bg-white rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.effective_from ? "border-red-300" : "border-gray-200"}`}
                    />
                    <FieldError error={errors.effective_from} />
                  </div>
                )}
                <p className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <MdOutlineInfo className="text-cyan-600 shrink-0 mt-0.5" size={14} />
                  <span>
                    {!timingChanged
                      ? t("shift.add.timeChangeHint")
                      : isScheduled
                        ? t("shift.add.timeChangeScheduled", { date: longDate(fromValue) })
                        : t("shift.add.timeChangeApplyFrom", { date: longDate(fromValue) })}
                  </span>
                </p>
              </div>

              {versions.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <p className="px-4 py-2.5 bg-[#f8f9fc] border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    {t("shift.add.timingHistory")}
                  </p>
                  <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto custom-scrollbar">
                    {versions.map((v, i) => {
                      const inForce =
                        i === inForceIdx &&
                        (!timingToday ||
                          (hms(timingToday.start_time) === hms(v.start_time) &&
                            hms(timingToday.end_time) === hms(v.end_time)));
                      return (
                        <li key={`${v.effective_from}-${i}`} className="flex items-center gap-2 px-4 py-2 text-xs">
                          <span className="text-gray-500 min-w-0 truncate">
                            {v.effective_from <= "2000-01-01"
                              ? t("shift.add.timingSinceStart")
                              : <Ltr>{longDate(v.effective_from)}</Ltr>}
                          </span>
                          <span className="ms-auto font-semibold text-gray-800 whitespace-nowrap">
                            <Ltr>{fmtTimeShort(v.start_time)} – {fmtTimeShort(v.end_time)}</Ltr>
                          </span>
                          {inForce ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded border text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 whitespace-nowrap">
                              {t("shift.add.inForce")}
                            </span>
                          ) : v.effective_from > fy.today ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded border text-[10px] font-bold text-sky-700 bg-sky-50 border-sky-200 whitespace-nowrap">
                              {t("shift.add.scheduled")}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Weekly Off Calendar */}
          <div className={`border rounded-xl bg-white shadow-sm ${offDaysError ? "border-red-300" : "border-gray-200"}`}>
            {/* Calendar Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200 bg-[#f8f9fc] rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-900">{t("shift.add.weeklyOff")}</h3>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-1.5 group relative">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBulkSelectActive}
                      onChange={(e) => setIsBulkSelectActive(e.target.checked)}
                      className="w-4 h-4 text-[#14959a] accent-[#14959a] rounded border-gray-300 focus:ring-[#14959a] cursor-pointer"
                    />
                    <span className="text-sm font-bold text-gray-700">{t("shift.add.selectAll")}</span>
                  </label>
                  <div className="relative flex items-center cursor-help">
                    <MdOutlineInfo className="text-gray-400 hover:text-cyan-600 transition-colors" size={16} />
                    <div className="absolute bottom-full start-1/2 -translate-x-1/2 rtl:translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-white border border-gray-200 text-gray-800 text-[11px] font-medium leading-relaxed rounded-lg shadow-xl z-50 text-center">
                      {t("shift.add.selectAllHintFy")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewFy((y) => y - 1)}
                    disabled={!canPrevFy}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MdOutlineChevronLeft className="text-xl rtl:rotate-180" />
                  </button>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 min-w-[110px] justify-center whitespace-nowrap">
                    {viewLabel}
                    <YearStatusBadge year={viewYear} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewFy((y) => y + 1)}
                    disabled={!canNextFy}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MdOutlineChevronRight className="text-xl rtl:rotate-180" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Table */}
            <div className="overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f2f4f8] border-b border-gray-200">
                    <th className="sticky start-0 bg-[#f2f4f8] w-[140px] text-start px-4 py-3 text-sm font-bold text-gray-700 border-e border-gray-200 z-10">
                      {t("shift.add.month")}
                    </th>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <th key={day} className="w-9 min-w-[36px] text-center py-3 text-xs font-bold text-gray-600 border-e border-gray-200">
                        {day}
                      </th>
                    ))}
                    <th className="w-[140px] text-center px-4 py-3 text-sm font-bold text-gray-700">
                      {t("shift.add.summary")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {viewMonths.map(({ year, month, value }) => {
                    const days = daysIn(year, month);
                    let monthOffDaysCount = 0;
                    for (let day = 1; day <= days; day++) {
                      if (selectedOffDays.has(`${value}-${pad(day)}`)) monthOffDaysCount++;
                    }

                    return (
                      <tr key={value} className="hover:bg-gray-50/50 transition-colors">
                        {/* Month Name (Sticky) */}
                        <td className="sticky start-0 bg-white px-4 py-3 border-e border-gray-200 align-middle z-10">
                          <span className="text-[13px] font-semibold text-cyan-700 whitespace-nowrap">
                            {t("shift.add.monthYear", { month: t(`shift.add.months.${MONTHS[month - 1]}`), year })}
                          </span>
                        </td>

                        {/* Days 1 to 31 */}
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                          if (day > days) {
                            // Empty cell for days that don't exist in the month (e.g., Feb 30)
                            return <td key={day} className="p-1 border-e border-gray-200 bg-gray-50/50"></td>;
                          }
                          const formattedDate = `${value}-${pad(day)}`;
                          const isSelected = selectedOffDays.has(formattedDate);
                          const locked = dayLocked(formattedDate);
                          const dayInitial = t(`shift.add.weekdayInitials.${WEEKDAY_INITIALS[weekdayOf(year, month, day)]}`);

                          return (
                            <td key={day} className="p-1 border-e border-gray-200 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => toggleDay(formattedDate)}
                                disabled={locked}
                                title={dayTitle(formattedDate)}
                                className={`w-7 h-8 flex items-center justify-center rounded transition-all border mx-auto disabled:cursor-not-allowed ${
                                  isSelected
                                    ? `bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm font-bold ${locked ? "opacity-60" : ""}`
                                    : locked
                                      ? "bg-transparent border-transparent text-gray-300 font-medium"
                                      : "bg-transparent border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 font-medium"
                                }`}
                              >
                                <span className="text-[12px]">{dayInitial}</span>
                              </button>
                            </td>
                          );
                        })}

                        {/* Summary */}
                        <td className="px-4 py-3 text-center align-middle">
                          <span className="text-xs font-semibold text-emerald-500 whitespace-nowrap">
                            {t("shift.add.total")} <strong className="font-bold text-sm text-emerald-600 ms-1">{pad(monthOffDaysCount)}</strong>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
              <span>{t("shift.add.pastDayHint")}</span>
              <FieldError message={offDaysError} className="mt-0" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={() => navigate("/admin/shift-management")}
            className="px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition shadow-sm"
          >
            {t("shift.add.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || loadingShift || !shiftLoaded}
            className="px-6 py-2.5 rounded-lg bg-[#14959a] hover:bg-cyan-700 text-white text-sm font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isEdit ? t("shift.add.saveChanges") : t("shift.add.submitAdd")}
          </button>
        </div>
      </form>
    </div>
  );
}

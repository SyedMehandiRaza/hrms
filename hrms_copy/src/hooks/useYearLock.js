import { useTranslation } from "react-i18next";
import useFiscalYear from "./useFiscalYear";

// Read-only mode for write buttons (create / edit / approve …).
//
//   const lock = useYearLock();            // the year in the switcher
//   const lock = useYearLock(row.date);    // also the year a record belongs to
//   <button disabled={lock.locked} title={lock.title}>…</button>
//   {!lock.locked && <button>…</button>}
//
// locked → the selected year is closed + locked, or `date` ("YYYY-MM-DD" /
// "YYYY-MM") falls in a closed + locked year. The backend refuses those writes
// anyway (PeriodClosed); this only keeps the UI honest.
export const lockedYearOf = (years, date) => {
  if (!date) return null;
  const d = String(date).slice(0, 10);
  const ym = d.slice(0, 7);
  return (
    years.find((y) => y.is_locked && (d.length === 7 ? ym >= y.start_date.slice(0, 7) && ym <= y.end_date.slice(0, 7) : d >= y.start_date && d <= y.end_date)) ||
    null
  );
};

export default function useYearLock(date) {
  const { t } = useTranslation("fiscalYear");
  const fy = useFiscalYear();
  const byDate = lockedYearOf(fy.years, date);
  const locked = fy.isLocked || !!byDate;
  const label = byDate?.label || fy.label;
  return {
    locked,
    label,
    title: locked ? t("locked.tooltip", { label }) : undefined,
    isLockedDate: (d) => fy.isLocked || !!lockedYearOf(fy.years, d),
    // Tooltip for a record locked by its own date: names the record's year
    // (falls back to the selected year when only that one is locked).
    titleFor: (d) => {
      const own = lockedYearOf(fy.years, d);
      if (own) return t("locked.tooltip", { label: own.label });
      return fy.isLocked ? t("locked.tooltip", { label: fy.label }) : undefined;
    },
  };
}

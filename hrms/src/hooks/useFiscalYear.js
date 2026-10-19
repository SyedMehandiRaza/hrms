import { STATIC_FISCAL_YEAR } from "../data/session";
import {
  fyLabel,
  fyRange,
  monthsOfFy,
  isInFy,
  todayIn,
  defaultMonthIn,
  defaultDateIn,
} from "../utils/fiscalYear";

// The financial year the app is showing (the header's year switcher).
//
//   const { selected, range, isLocked, label, startMonth, months, ... } = useFiscalYear();
//
//   selected   : year_key (e.g. 2026) — null until the years load
//   failed     : the years could not be loaded (render <FyLoadError />)
//   me         : { employee_id, date_of_joining } of the caller, or null
//   range      : { from, to } "YYYY-MM-DD" of the selected FY
//   label      : "FY 2026" / "FY 2026-27"
//   isLocked   : the selected year is closed + locked → hide/disable writes
//   isClosed   : status CLOSED (locked or not)
//   isCurrent  : the selected year contains today (company timezone)
//   months     : its 12 months in FY order [{ year, month, value: "YYYY-MM", key }]
//   today      : "YYYY-MM-DD" in the company timezone
//   defaultMonth / defaultDate : a sensible pick inside the selected FY
//   inFy(date) : is a date / "YYYY-MM" inside the selected FY
//   version    : bumps on every year change (add it to reload deps)
// The object is rebuilt each render: put primitives (selected, version) in
// effect deps, not the object or its functions.
export default function useFiscalYear() {
  const fy = STATIC_FISCAL_YEAR;

  const startMonth = fy.startMonth || 1;
  const year = fy.years.find((y) => y.year_key === fy.selected) || null;
  const range = fy.selected
    ? year
      ? { from: year.start_date, to: year.end_date }
      : fyRange(startMonth, fy.selected)
    : null;
  const today = todayIn(fy.timezone);
  return {
    loaded: true,
    // the years failed to load (not loaded, not retrying) → show an error state
    failed: false,
    me: fy.me || null,
    years: fy.years,
    current: fy.current,
    selected: fy.selected,
    year,
    startMonth,
    timezone: fy.timezone,
    range,
    label: year?.label || (fy.selected ? fyLabel(startMonth, fy.selected) : ""),
    status: year?.status || null,
    isLocked: !!year?.is_locked,
    isClosed: year?.status === "CLOSED",
    isCurrent: !!fy.current && fy.selected === fy.current.year_key,
    months: fy.selected ? monthsOfFy(startMonth, fy.selected) : [],
    today,
    defaultMonth: defaultMonthIn(range, today),
    defaultDate: defaultDateIn(range, today),
    inFy: (date) => (range ? isInFy(date, range) : true),
    version: 0,
  };
}

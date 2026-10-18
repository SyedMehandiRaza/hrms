import { useState } from "react";
import useFiscalYear from "./useFiscalYear";

// Month navigation for a calendar, kept inside the selected financial year.
//
//   const nav = useFyMonthNav();
//   nav.year, nav.month (0-based), nav.value ("YYYY-MM")
//   nav.prev() / nav.next() — stop at the FY's first / last month
//   nav.canPrev / nav.canNext, nav.goToday() → the FY's default month
//
// Starts on fy.defaultMonth (today when inside the FY) and resets to it when
// the year switcher changes (fy.version) — derived, no effect needed.
export default function useFyMonthNav() {
  const fy = useFiscalYear();
  const [picked, setPicked] = useState({ version: fy.version, value: null });

  const value = picked.version === fy.version && picked.value ? picked.value : fy.defaultMonth;
  const [y, m] = value.split("-").map(Number);
  const first = fy.range ? fy.range.from.slice(0, 7) : null;
  const last = fy.range ? fy.range.to.slice(0, 7) : null;

  const shift = (delta) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if ((first && next < first) || (last && next > last)) return;
    setPicked({ version: fy.version, value: next });
  };

  return {
    year: y,
    month: m - 1,
    value,
    canPrev: !first || value > first,
    canNext: !last || value < last,
    prev: () => shift(-1),
    next: () => shift(1),
    goToday: () => setPicked({ version: fy.version, value: null }),
    isToday: value === fy.today.slice(0, 7),
  };
}

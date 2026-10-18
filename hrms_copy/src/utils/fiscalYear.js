// Financial-year date maths for the UI — a mirror of the backend's
// utils/newHrms/fiscalYearDates.js. A company's FY starts on the 1st of its
// `startMonth` (1–12); `yearKey` is the calendar year the FY starts in.
//   startMonth 1 → FY 2026    = 2026-01-01 … 2026-12-31
//   startMonth 4 → FY 2026-27 = 2026-04-01 … 2027-03-31
// Business years always come from here (or the API), never getFullYear().
// Dates are "YYYY-MM-DD" strings; months are "YYYY-MM".

const pad = (n) => String(n).padStart(2, "0");

const toMonth = (m) => {
  const n = Number(m);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1;
};

export const MONTH_KEYS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

// "FY 2026" (January start) or "FY 2026-27" (any other start month).
export const fyLabel = (startMonth, yearKey) =>
  toMonth(startMonth) === 1
    ? `FY ${yearKey}`
    : `FY ${yearKey}-${pad((Number(yearKey) + 1) % 100)}`;

// { from, to } — the FY's first and last day.
export const fyRange = (startMonth, yearKey) => {
  const m = toMonth(startMonth);
  const y = Number(yearKey);
  const end = new Date(Date.UTC(y, m - 1 + 12, 0)); // day before the next start
  return { from: `${y}-${pad(m)}-01`, to: end.toISOString().slice(0, 10) };
};

// The 12 months of an FY in order (Apr…Mar for April):
// [{ year, month, value: "YYYY-MM", key: "apr" }]
export const monthsOfFy = (startMonth, yearKey) => {
  const m = toMonth(startMonth);
  return Array.from({ length: 12 }, (_, i) => {
    const idx = m - 1 + i;
    const year = Number(yearKey) + Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    return { year, month, value: `${year}-${pad(month)}`, key: MONTH_KEYS[month - 1] };
  });
};

// The year_key of the FY a date ("YYYY-MM-DD" or "YYYY-MM") falls in.
export const yearKeyFor = (startMonth, date) => {
  const [y, mo] = String(date).slice(0, 7).split("-").map(Number);
  return mo >= toMonth(startMonth) ? y : y - 1;
};

// Is a date / month inside the range? Months compare by their "YYYY-MM".
export const isInFy = (date, range) => {
  if (!date || !range) return false;
  const s = String(date);
  if (s.length === 7) return s >= range.from.slice(0, 7) && s <= range.to.slice(0, 7);
  const d = s.slice(0, 10);
  return d >= range.from && d <= range.to;
};

// Keep a "YYYY-MM" inside the FY: before → first month, after → last month.
export const clampMonth = (value, range) => {
  if (!range) return value;
  const first = range.from.slice(0, 7);
  const last = range.to.slice(0, 7);
  if (!value) return last;
  if (value < first) return first;
  if (value > last) return last;
  return value;
};

// Same for a "YYYY-MM-DD".
export const clampDate = (value, range) => {
  if (!range) return value;
  if (!value) return range.to;
  if (value < range.from) return range.from;
  if (value > range.to) return range.to;
  return value;
};

// "Today" ("YYYY-MM-DD") in an IANA timezone (the company's), not the browser's.
export const todayIn = (timezone) => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
};

// A sensible default month inside the selected FY: today's month when today is
// inside it, else the FY's last month (a past year) / first month (a future one).
export const defaultMonthIn = (range, today) => {
  if (!range) return (today || todayIn()).slice(0, 7);
  const m = (today || todayIn()).slice(0, 7);
  return clampMonth(m, range);
};

// A default "YYYY-MM-DD" inside the FY (today when inside, else the nearest edge).
export const defaultDateIn = (range, today) => clampDate(today || todayIn(), range);

// Calendar years the FY touches (one for a January FY, two otherwise).
export const calendarYearsOf = (range) => {
  if (!range) return [];
  const a = Number(range.from.slice(0, 4));
  const b = Number(range.to.slice(0, 4));
  return a === b ? [a] : [a, b];
};

// Which years a user may pick. Admins: every year. Employees: only years they
// worked in (not a future PLANNED year, nothing that ended before they joined).
// `me` = /fiscal-years/current's { employee_id, date_of_joining } (the login
// payload has no joining date); the user's own fields are the fallback.
export const visibleYearsFor = (years, user, current, me = null) => {
  if (user?.layoutRole !== "EMPLOYEE") return years;
  const joined = me?.date_of_joining || user?.date_of_joining || user?.joining_date || null;
  return years.filter(
    (y) =>
      (y.status !== "PLANNED" || y.year_key === current?.year_key) &&
      (!joined || y.end_date >= String(joined).slice(0, 10)),
  );
};

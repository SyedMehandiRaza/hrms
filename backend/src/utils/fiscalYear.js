// Financial-year dates, mirroring the UI's hrms/src/utils/fiscalYear.js.
// A company's FY starts on the 1st of its start month (1–12); `yearKey` is the
// calendar year the FY starts in:
//   start month 1 → FY 2026    = 2026-01-01 … 2026-12-31
//   start month 4 → FY 2026-27 = 2026-04-01 … 2027-03-31
// Dates are "YYYY-MM-DD" strings.

const pad = (n) => String(n).padStart(2, "0");

// "FY 2026" (January start) or "FY 2026-27" (any other start month).
const fyLabel = (startMonth, yearKey) =>
  startMonth === 1 ? `FY ${yearKey}` : `FY ${yearKey}-${pad((yearKey + 1) % 100)}`;

// { startDate, endDate }: the 1st of the start month to the day before the same date a year later.
const fyRange = (startMonth, yearKey) => {
  const end = new Date(Date.UTC(yearKey, startMonth - 1 + 12, 0));
  return { startDate: `${yearKey}-${pad(startMonth)}-01`, endDate: end.toISOString().slice(0, 10) };
};

module.exports = { fyLabel, fyRange };

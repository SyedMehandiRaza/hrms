// "YYYY-MM-DD" that is a real calendar day (Date.parse alone accepts e.g. 2026-02-30).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value) => {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

module.exports = { ISO_DATE, isRealDate };

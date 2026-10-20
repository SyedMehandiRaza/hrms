// The current time, in one place so tests can move it: jest.spyOn(clock, "now").mockReturnValue(...).
const clock = {
  now: () => new Date(),
};

// "YYYY-MM-DD" of `date` in the IANA time zone `timeZone`.
const dateInZone = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

// "YYYY-MM-DD" shifted by whole days (UTC arithmetic on a date string).
const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

module.exports = { clock, dateInZone, addDays };

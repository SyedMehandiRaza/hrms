const { CompanyTimeSetting } = require("../models");

// Company-time helpers (plan decision 21: "today" is the company's timezone date; dates are
// "YYYY-MM-DD" strings). Instants are stored in UTC.

const DEFAULT_TZ = "Asia/Riyadh";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const companyTimezone = async (employerId, transaction) => {
  const settings = await CompanyTimeSetting.findOne({ where: { employer_id: employerId }, attributes: ["timezone"], transaction });
  return settings?.timezone || DEFAULT_TZ;
};

// The calendar date of an instant in a timezone.
const dateIn = (tz, at = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

const todayIn = (tz, now = new Date()) => dateIn(tz, now);

const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Offset (ms) of a timezone at an instant: local wall time minus UTC.
const offsetAt = (tz, at) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
};

// The UTC instant of local midnight at the start of `date` in `tz`.
const startOfDayUtc = (date, tz) => {
  const guess = new Date(`${date}T00:00:00Z`);
  let instant = new Date(guess.getTime() - offsetAt(tz, guess));
  instant = new Date(guess.getTime() - offsetAt(tz, instant)); // settle across DST changes
  return instant;
};

// End of a local day = the first instant of the next day (exclusive bound).
const endOfDayUtc = (date, tz) => startOfDayUtc(addDays(date, 1), tz);

// "16 Jan 2023" from "YYYY-MM-DD" (decision 44).
const formatDate = (date) => {
  if (!date) return null;
  const [y, m, d] = String(date).slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
};

// "21 Oct 2026, 11:00" for an instant in a timezone.
const formatDateTimeIn = (tz, at) => {
  const date = dateIn(tz, at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return `${formatDate(date)}, ${time}`;
};

const isRealDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

module.exports = {
  DEFAULT_TZ,
  companyTimezone,
  dateIn,
  todayIn,
  addDays,
  startOfDayUtc,
  endOfDayUtc,
  formatDate,
  formatDateTimeIn,
  isRealDate,
};

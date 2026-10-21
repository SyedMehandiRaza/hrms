const { Op } = require("sequelize");
const { sequelize, CompanyShift, ShiftWeekOff, FinancialYear } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { addDays } = require("../utils/clock");
const { UUID } = require("./department.service");
const { findShift } = require("./shift.service");
const { companyToday, financialYearOn } = require("./companyTime.service");
const { isDateLocked } = require("./periodLock.service");

// Shift week-offs (docs/plans/workforce-and-lifecycle.md D38, D39). Saving replaces a shift's off
// days of one financial year from today onward; past days and days in a closed or locked period
// never change. "Copy to next year" adds the weekdays that were off at least 80% of the time in
// the current year to the next one, never removing anything.

const PATTERN_SHARE = 0.8;

const yearRow = (fy) => ({ id: fy.id, label: fy.label, start_date: fy.start_date, end_date: fy.end_date, status: fy.status });
const weekday = (isoDate) => new Date(`${isoDate}T00:00:00Z`).getUTCDay();
const daysOf = (fy) => {
  const out = [];
  for (let d = fy.start_date; d <= fy.end_date; d = addDays(d, 1)) out.push(d);
  return out;
};
const yearClosed = (fy) => fy.status === "CLOSED" || fy.is_locked;

const findYear = async (employerId, id, transaction) => {
  const fy = UUID.test(String(id)) ? await FinancialYear.findOne({ where: { id, employer_id: employerId }, transaction }) : null;
  if (!fy) throw new ErrorHandler("NOT_FOUND");
  return fy;
};

// Months of the year ("YYYY-MM") that are locked for week-off changes.
const lockedMonths = async (employerId, fy) => {
  const months = [...new Set(daysOf(fy).map((d) => d.slice(0, 7)))];
  const locked = [];
  for (const month of months) if (await isDateLocked(employerId, `${month}-01`)) locked.push(month);
  return locked;
};

const datesOf = async (shiftId, fy, transaction) =>
  (
    await ShiftWeekOff.findAll({
      where: { shift_id: shiftId, off_date: { [Op.between]: [fy.start_date, fy.end_date] } },
      attributes: ["off_date"],
      order: [["off_date", "ASC"]],
      raw: true,
      transaction,
    })
  ).map((r) => r.off_date);

// GET /shifts/:id/week-offs?financialYearId= (default: the year containing today).
const getWeekOffs = async ({ employerId }, shiftId, { financialYearId }) => {
  const shift = await findShift(employerId, shiftId, { attributes: ["id"] });
  const today = await companyToday(employerId);
  const fy = financialYearId ? await findYear(employerId, financialYearId) : await financialYearOn(employerId, today);
  if (!fy) throw new ErrorHandler("NOT_FOUND");
  return {
    financial_year: yearRow(fy),
    dates: await datesOf(shift.id, fy),
    today,
    year_locked: yearClosed(fy),
    locked_months: await lockedMonths(employerId, fy),
  };
};

// PUT /shifts/:id/week-offs { financialYearId, dates }
const saveWeekOffs = async ({ employerId }, shiftId, { financialYearId, dates }) => {
  await sequelize.transaction(async (transaction) => {
    const shift = await findShift(employerId, shiftId, { transaction, lock: transaction.LOCK.UPDATE });
    const fy = await findYear(employerId, financialYearId, transaction);
    if (dates.some((d) => d < fy.start_date || d > fy.end_date)) {
      throw new ErrorHandler("VALIDATION_FAILED", { errors: { dates: "weekOffOutsideFy" } });
    }
    const today = await companyToday(employerId, { transaction });
    const existing = new Set(await datesOf(shift.id, fy, transaction));
    const wanted = new Set(dates);
    const added = dates.filter((d) => !existing.has(d));
    const removed = [...existing].filter((d) => !wanted.has(d));
    for (const d of [...added, ...removed]) {
      if (d < today || yearClosed(fy) || (await isDateLocked(employerId, d, { transaction }))) {
        throw new ErrorHandler("SHIFT_WEEKOFF_LOCKED");
      }
    }
    if (removed.length) await ShiftWeekOff.destroy({ where: { shift_id: shift.id, off_date: removed }, transaction });
    if (added.length) {
      await ShiftWeekOff.bulkCreate(
        added.map((off_date) => ({ shift_id: shift.id, employer_id: employerId, off_date })),
        { transaction }
      );
    }
  });
  return getWeekOffs({ employerId }, shiftId, { financialYearId });
};

// The current year and the next one (it must exist and not be closed or locked), or 409.
const yearsForCopy = async (employerId, toFy) => {
  const today = await companyToday(employerId);
  const current = await financialYearOn(employerId, today);
  const next = current ? await FinancialYear.findOne({ where: { employer_id: employerId, start_date: addDays(current.end_date, 1) } }) : null;
  if (!next || yearClosed(next) || (toFy && toFy !== next.id)) throw new ErrorHandler("SHIFT_WEEKOFF_NO_NEXT_FY");
  return { today, current, next };
};

// Weekdays (0 = Sunday) off on at least 80% of their occurrences in the year.
const patternOf = (offDates, fy) => {
  const totals = Array(7).fill(0);
  daysOf(fy).forEach((d) => (totals[weekday(d)] += 1));
  const offs = Array(7).fill(0);
  offDates.forEach((d) => (offs[weekday(d)] += 1));
  return totals.map((n, w) => (n && offs[w] / n >= PATTERN_SHARE ? w : null)).filter((w) => w !== null);
};

// The dates a copy would add to one shift: the pattern's weekdays in the next year, from today,
// outside locked months, not already there.
const datesToAdd = async (employerId, shiftId, { today, current, next }) => {
  const weekdays = patternOf(await datesOf(shiftId, current), current);
  const have = new Set(await datesOf(shiftId, next));
  const out = [];
  const locked = new Set(await lockedMonths(employerId, next));
  for (const d of daysOf(next)) {
    if (weekdays.includes(weekday(d)) && d >= today && !have.has(d) && !locked.has(d.slice(0, 7))) out.push(d);
  }
  return { weekdays, dates: out };
};

// GET /shifts/week-offs/copy-preview?to_fy=
const copyPreview = async ({ employerId }, { to_fy: toFy }) => {
  const years = await yearsForCopy(employerId, toFy);
  const shifts = await CompanyShift.findAll({ where: { employer_id: employerId }, order: [["name", "ASC"]], attributes: ["id", "name"] });
  const items = [];
  for (const s of shifts) {
    const { weekdays, dates } = await datesToAdd(employerId, s.id, years);
    items.push({ shift_id: s.id, name: s.name, weekdays, dates_to_add: dates.length });
  }
  return { from_fy: yearRow(years.current), to_fy: yearRow(years.next), shifts: items };
};

// POST /shifts/week-offs/copy { to_fy, shift_ids }: adds only; running it twice adds nothing.
const copyWeekOffs = async ({ employerId }, { to_fy: toFy, shift_ids: shiftIds }) => {
  const years = await yearsForCopy(employerId, toFy);
  if (!shiftIds.every((id) => UUID.test(id))) throw new ErrorHandler("NOT_FOUND");
  const shifts = await CompanyShift.findAll({ where: { id: shiftIds, employer_id: employerId }, attributes: ["id"] });
  if (shifts.length !== shiftIds.length) throw new ErrorHandler("NOT_FOUND");
  const added = {};
  await sequelize.transaction(async (transaction) => {
    for (const s of shifts) {
      const { dates } = await datesToAdd(employerId, s.id, years);
      if (dates.length) {
        await ShiftWeekOff.bulkCreate(
          dates.map((off_date) => ({ shift_id: s.id, employer_id: employerId, off_date })),
          { transaction, ignoreDuplicates: true }
        );
      }
      added[s.id] = dates.length;
    }
  });
  return { to_fy: yearRow(years.next), added };
};

// GET /shifts/week-offs/years: the years the week-off calendar can show, oldest first, with
// today (company time) and the year that contains it.
const listYears = async ({ employerId }) => {
  const today = await companyToday(employerId);
  const years = await FinancialYear.findAll({ where: { employer_id: employerId }, order: [["start_date", "ASC"]] });
  const items = [];
  for (const fy of years) {
    items.push({ ...yearRow(fy), year_locked: yearClosed(fy), locked_months: await lockedMonths(employerId, fy) });
  }
  const current = years.find((fy) => fy.start_date <= today && fy.end_date >= today);
  return { today, current_id: current ? current.id : null, years: items };
};

module.exports = { getWeekOffs, saveWeekOffs, copyPreview, copyWeekOffs, listYears };

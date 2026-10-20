const { Op } = require("sequelize");
const { sequelize, CompanyShift, ShiftTimeHistory, Employee } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { UUID, likePattern } = require("./department.service");
const { companyToday, financialYearOn } = require("./companyTime.service");
const { isDateLocked } = require("./periodLock.service");

// Shifts (docs/plans/workforce-and-lifecycle.md D35–D37). Always the caller's own company.
// A shift's times live in hrms_shift_time_history: the row in force on a day is the latest one
// effective on or before it; rows after today are "Scheduled". company_shifts.start_time /
// end_time hold the times of the latest row in force when it was last saved.

const hhmm = (time) => (time ? String(time).slice(0, 5) : null);
const asTime = (value) => (String(value).length === 5 ? `${value}:00` : String(value));
const isOvernight = (start, end) => hhmm(end) < hhmm(start);

// The row in force on `day` among rows sorted by effective_from ascending.
const inForce = (rows, day) => rows.filter((r) => r.effective_from <= day).pop() || null;

const toTiming = (row, current, today) => ({
  effective_from: row.effective_from,
  start_time: hhmm(row.start_time),
  end_time: hhmm(row.end_time),
  is_overnight: isOvernight(row.start_time, row.end_time),
  state: row.effective_from > today ? "SCHEDULED" : current && row.id === current.id ? "IN_FORCE" : "PAST",
});

const toItem = (shift, rows, today, { withHistory = false } = {}) => {
  const current = inForce(rows, today);
  const shown = current || rows[0] || { start_time: shift.start_time, end_time: shift.end_time };
  const item = {
    id: shift.id,
    name: shift.name,
    start_time: hhmm(shown.start_time),
    end_time: hhmm(shown.end_time),
    is_overnight: isOvernight(shown.start_time, shown.end_time),
    scheduled: rows.filter((r) => r.effective_from > today).map((r) => toTiming(r, current, today)),
    created_at: shift.createdAt,
    updated_at: shift.updatedAt,
  };
  if (withHistory) item.history = [...rows].reverse().map((r) => toTiming(r, current, today));
  return item;
};

const timingsOf = async (shiftIds, transaction) => {
  const rows = await ShiftTimeHistory.findAll({
    where: { shift_id: shiftIds },
    order: [
      ["effective_from", "ASC"],
      ["created_at", "ASC"],
    ],
    raw: true,
    transaction,
  });
  return (id) => rows.filter((r) => r.shift_id === id);
};

// The caller's live shift, or 404 (also for a malformed id).
const findShift = async (employerId, id, options = {}) => {
  const shift = UUID.test(String(id)) ? await CompanyShift.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!shift) throw new ErrorHandler("NOT_FOUND");
  return shift;
};

// GET /shifts?search=&page=&limit= (by name).
const listShifts = async ({ employerId }, { page, limit, search }) => {
  const where = { employer_id: employerId };
  if (search) where.name = { [Op.like]: likePattern(search) };
  const { count, rows } = await CompanyShift.findAndCountAll({
    where,
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  const [today, timings] = await Promise.all([companyToday(employerId), timingsOf(rows.map((s) => s.id))]);
  return { items: rows.map((s) => toItem(s, timings(s.id), today)), total: count, page, limit };
};

// GET /shifts/:id: with the whole timing history (newest first).
const getShift = async ({ employerId }, id) => {
  const shift = await findShift(employerId, id);
  const [today, timings] = await Promise.all([companyToday(employerId), timingsOf([shift.id])]);
  return toItem(shift, timings(shift.id), today, { withHistory: true });
};

const UNIQUE_KEY_CODES = { uq_company_shifts_employer_id_name_live_key: "SHIFT_NAME_TAKEN" };

const assertNameFree = async (employerId, name, exceptId, transaction) => {
  const where = { employer_id: employerId, name };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  if (await CompanyShift.findOne({ where, attributes: ["id"], transaction })) throw new ErrorHandler("SHIFT_NAME_TAKEN");
};

// A time change applies from a day on or after the start of the current financial year that
// isn't in a closed or locked period (D36).
const assertEffectiveFrom = async (employerId, day, today, transaction) => {
  const fy = await financialYearOn(employerId, today, { transaction });
  const tooEarly = fy && day < fy.start_date;
  if (tooEarly || (await isDateLocked(employerId, day, { transaction }))) {
    throw new ErrorHandler("VALIDATION_FAILED", { errors: { effective_from: "shiftEffectiveFromInvalid" } });
  }
};

// POST /shifts: the first timing row is effective from today.
const createShift = async ({ employerId, userId }, body) => {
  const id = await sequelize.transaction(async (transaction) => {
    await assertNameFree(employerId, body.name, null, transaction);
    const today = await companyToday(employerId, { transaction });
    const shift = await saveOrClash(
      () =>
        CompanyShift.create(
          { employer_id: employerId, name: body.name, start_time: asTime(body.start_time), end_time: asTime(body.end_time) },
          { transaction }
        ),
      UNIQUE_KEY_CODES
    );
    await ShiftTimeHistory.create(
      {
        shift_id: shift.id,
        employer_id: employerId,
        start_time: asTime(body.start_time),
        end_time: asTime(body.end_time),
        effective_from: today,
        created_by: userId,
      },
      { transaction }
    );
    return shift.id;
  });
  return getShift({ employerId }, id);
};

// PUT /shifts/:id. A name-only edit adds no timing row; new times add (or, for the same day,
// replace) a row effective from `effective_from` (default today).
const updateShift = async ({ employerId, userId }, id, body) => {
  await sequelize.transaction(async (transaction) => {
    const shift = await findShift(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    await assertNameFree(employerId, body.name, shift.id, transaction);
    const today = await companyToday(employerId, { transaction });
    const timings = (await timingsOf([shift.id], transaction))(shift.id);
    const current = inForce(timings, today) || timings[0];
    const timesChanged =
      !current || hhmm(current.start_time) !== hhmm(body.start_time) || hhmm(current.end_time) !== hhmm(body.end_time);

    const changes = { name: body.name };
    if (timesChanged) {
      const from = body.effective_from || today;
      await assertEffectiveFrom(employerId, from, today, transaction);
      const values = { start_time: asTime(body.start_time), end_time: asTime(body.end_time) };
      const sameDay = await ShiftTimeHistory.findOne({ where: { shift_id: shift.id, effective_from: from }, transaction });
      if (sameDay) await sameDay.update({ ...values, created_by: userId }, { transaction });
      else await ShiftTimeHistory.create({ shift_id: shift.id, employer_id: employerId, effective_from: from, created_by: userId, ...values }, { transaction });
      if (from <= today) Object.assign(changes, values);
    }
    await saveOrClash(() => shift.update(changes, { transaction }), UNIQUE_KEY_CODES);
  });
  return getShift({ employerId }, id);
};

// DELETE /shifts/:id. Blocked while a non-exited employee has the shift (D37); otherwise a soft
// delete (the name becomes reusable).
const deleteShift = async ({ employerId }, id) =>
  sequelize.transaction(async (transaction) => {
    const shift = await findShift(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    const inUse = await Employee.count({
      where: { employer_id: employerId, shift_id: shift.id, employment_status: { [Op.ne]: "EXITED" } },
      transaction,
    });
    if (inUse) throw new ErrorHandler("SHIFT_IN_USE");
    await shift.destroy({ transaction });
    return { id: shift.id };
  });

module.exports = { listShifts, getShift, createShift, updateShift, deleteShift, findShift };

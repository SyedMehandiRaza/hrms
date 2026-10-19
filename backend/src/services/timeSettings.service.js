const { sequelize, CompanyTimeSetting, FinancialYear } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { fyLabel, fyRange } = require("../utils/fiscalYear");

// Company time settings: timezone and financial-year start month (D30). Always the
// caller's own company: the employer id comes from the access token. The other
// settings (lock mode, review days, …) are read here but changed by the Financial
// Year module.

const SETTING_FIELDS = [
  "timezone",
  "fy_start_month",
  "review_days_before",
  "auto_open_next_year",
  "reopen_window_days",
  "lock_mode",
  "pending_on_close",
  "offline_backdate_days",
];

// Years whose dates follow the start month; CLOSING and CLOSED years keep theirs.
const REDATED_STATUSES = ["PLANNED", "OPEN"];

const toResponse = (settings, startMonthLocked) => ({
  ...Object.fromEntries(SETTING_FIELDS.map((field) => [field, settings[field]])),
  // The UI disables the start month when true.
  fy_start_month_locked: startMonthLocked,
});

const findSettings = async (employerId, options = {}) => {
  const settings = await CompanyTimeSetting.findOne({ where: { employer_id: employerId }, ...options });
  if (!settings) throw new ErrorHandler("NOT_FOUND");
  return settings;
};

// The start month locks once any year is CLOSING or CLOSED, locked or not (D30).
const START_MONTH_LOCKING_STATUSES = ["CLOSING", "CLOSED"];
const isStartMonthLocked = async (employerId, transaction) =>
  (await FinancialYear.count({ where: { employer_id: employerId, status: START_MONTH_LOCKING_STATUSES }, transaction })) > 0;

// GET /company/time-settings (ADMIN or financial_year:read).
const getTimeSettings = async ({ employerId }) => {
  const settings = await findSettings(employerId);
  return toResponse(settings, await isStartMonthLocked(employerId));
};

// Re-dates every PLANNED/OPEN year to the new start month. year_key (the calendar
// year the FY starts in) stays; dates and label follow from it.
const redateYears = async (employerId, startMonth, transaction) => {
  const years = await FinancialYear.findAll({
    where: { employer_id: employerId, status: REDATED_STATUSES },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  for (const year of years) {
    const { startDate, endDate } = fyRange(startMonth, year.year_key);
    await year.update({ start_date: startDate, end_date: endDate, label: fyLabel(startMonth, year.year_key) }, { transaction });
  }
};

// PATCH /company/time-settings (ADMIN or financial_year:update). Body (validated):
// { timezone?, fy_start_month? }. A timezone change applies going forward and
// rewrites nothing. A start month equal to the current one is no change (allowed
// even while locked).
const updateTimeSettings = async ({ employerId, userId }, body = {}) => {
  const { timezone, fy_start_month: startMonth } = body;
  if (timezone === undefined && startMonth === undefined) {
    throw new ErrorHandler("VALIDATION_FAILED", {
      errors: { timezone: "COMPANY_TIMEZONE_INVALID", fy_start_month: "COMPANY_FY_START_INVALID" },
    });
  }

  return sequelize.transaction(async (transaction) => {
    const settings = await findSettings(employerId, { transaction, lock: transaction.LOCK.UPDATE });
    const locked = await isStartMonthLocked(employerId, transaction);

    const changes = {};
    if (timezone !== undefined && timezone !== settings.timezone) changes.timezone = timezone;
    if (startMonth !== undefined && startMonth !== settings.fy_start_month) {
      if (locked) throw new ErrorHandler("COMPANY_FY_START_LOCKED");
      await redateYears(employerId, startMonth, transaction);
      changes.fy_start_month = startMonth;
    }

    if (Object.keys(changes).length) {
      await settings.update(changes, { transaction });
      console.info("[company] time settings updated", { employerId, userId, fields: Object.keys(changes) });
    }
    return toResponse(settings, locked);
  });
};

module.exports = { getTimeSettings, updateTimeSettings };

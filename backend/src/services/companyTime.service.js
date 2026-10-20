const { Op } = require("sequelize");
const { CompanyTimeSetting, FinancialYear } = require("../models");
const { clock, dateInZone } = require("../utils/clock");

// Company-local dates: "today" is the date in the company's time zone (time settings, default
// Asia/Riyadh as at sign-up), and the financial year containing a date.

const DEFAULT_TIMEZONE = "Asia/Riyadh";

const companyTimezone = async (employerId, { transaction } = {}) => {
  const setting = await CompanyTimeSetting.findOne({ where: { employer_id: employerId }, attributes: ["timezone"], transaction });
  return (setting && setting.timezone) || DEFAULT_TIMEZONE;
};

// "YYYY-MM-DD" today in the company's time zone.
const companyToday = async (employerId, options = {}) => dateInZone(clock.now(), await companyTimezone(employerId, options));

// The company's financial year containing the date, or null.
const financialYearOn = (employerId, isoDate, { transaction } = {}) =>
  FinancialYear.findOne({
    where: { employer_id: employerId, start_date: { [Op.lte]: isoDate }, end_date: { [Op.gte]: isoDate } },
    transaction,
  });

module.exports = { companyToday, companyTimezone, financialYearOn, DEFAULT_TIMEZONE };

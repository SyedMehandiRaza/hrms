const { Op } = require("sequelize");
const { PeriodLock } = require("../models");
const { financialYearOn } = require("./companyTime.service");

// "Closed or locked period" (workforce D36, D38, D55): a date is locked when the financial year
// containing it is CLOSED or locked as a whole, or its month has a period lock for one of the
// given modules (ALL always counts). A date outside every financial year is not locked here;
// callers that need an existing year check that themselves.
const isDateLocked = async (employerId, isoDate, { modules = ["ATTENDANCE"], transaction } = {}) => {
  const fy = await financialYearOn(employerId, isoDate, { transaction });
  if (fy && (fy.status === "CLOSED" || fy.is_locked)) return true;
  const [year, month] = isoDate.split("-").map(Number);
  const lock = await PeriodLock.findOne({
    where: { employer_id: employerId, period_year: year, period_month: month, module: { [Op.in]: ["ALL", ...modules] } },
    attributes: ["id"],
    transaction,
  });
  return Boolean(lock);
};

module.exports = { isDateLocked };

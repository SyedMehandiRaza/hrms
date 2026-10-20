const { Op } = require("sequelize");
const { sequelize, Contract, ContractActivity } = require("../models");

// Expiry (plan decision 36). One shared function expires due SENT/VIEWED contracts with a
// conditional update (so a contract is expired once, whoever gets there first) and logs
// an EXPIRED activity (actor = system). The hourly job calls it for every company; every
// contract endpoint calls it for the caller's company first ("lazy expiry"), so stored
// status is always true. `onExpired` (notifications, ticket 14) runs after each commit.

const PENDING = ["SENT", "VIEWED"];
let onExpired = null;
const setExpiredHandler = (fn) => {
  onExpired = fn;
};

// → ids of the contracts this call expired.
const expireDue = async ({ employerId, contractId, now = new Date() } = {}) => {
  const where = { status: { [Op.in]: PENDING }, expires_at: { [Op.lte]: now } };
  if (employerId) where.employer_id = employerId;
  if (contractId) where.id = contractId;
  const due = await Contract.findAll({ where, attributes: ["id", "employer_id"] });
  const expired = [];
  for (const { id, employer_id: emp } of due) {
    const won = await sequelize.transaction(async (transaction) => {
      const [count] = await Contract.update(
        { status: "EXPIRED" },
        { where: { id, status: { [Op.in]: PENDING }, expires_at: { [Op.lte]: now } }, transaction }
      );
      if (count !== 1) return false;
      await ContractActivity.create({ employer_id: emp, contract_id: id, action: "EXPIRED", actor_user_id: null }, { transaction });
      return true;
    });
    if (won) {
      expired.push(id);
      if (onExpired) {
        try {
          await onExpired(id);
        } catch (err) {
          console.error("[contracts] expiry notification failed", { contractId: id, error: err.message });
        }
      }
    }
  }
  return expired;
};

module.exports = { expireDue, setExpiredHandler };

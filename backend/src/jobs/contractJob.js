const { Op } = require("sequelize");
const { sequelize, Contract, ContractActivity, ContractRecipient } = require("../models");
const { expireDue } = require("../services/contractExpiry.service");
const { isRecipientActive } = require("../services/contractParties.service");
const { emitContractEvent } = require("../services/contractEvents");
const { translate } = require("../utils/i18n");

// Hourly contract job (plan decisions 36, 41, 43). Every step uses conditional updates, so
// several instances (or overlapping runs) change each contract once:
//   1. expire SENT/VIEWED contracts past their expiry;
//   2. remind once: SENT/VIEWED, within 48 h of expiry, sent more than 48 h before it;
//   3. auto-revoke SENT/VIEWED/SUBMITTED contracts whose recipient is no longer active.
// It only reads employee and staffing data (ADR 0008).

const SCHEDULE = "0 * * * *";
const HOUR = 3600 * 1000;
const REMIND_WINDOW = 48 * HOUR;
const AUTO_REVOKE_REASON = translate("recipientNoLongerActive", "en");

const sendReminders = async (now) => {
  const due = await Contract.findAll({
    where: {
      status: { [Op.in]: ["SENT", "VIEWED"] },
      reminder_sent_at: null,
      expires_at: { [Op.gt]: now, [Op.lte]: new Date(now.getTime() + REMIND_WINDOW) },
      [Op.and]: sequelize.literal("TIMESTAMPDIFF(SECOND, `Contract`.`sent_at`, `Contract`.`expires_at`) > 172800"),
    },
    attributes: ["id", "employer_id"],
  });
  for (const { id, employer_id: emp } of due) {
    const won = await sequelize.transaction(async (transaction) => {
      const [count] = await Contract.update(
        { reminder_sent_at: now },
        { where: { id, reminder_sent_at: null, status: { [Op.in]: ["SENT", "VIEWED"] } }, transaction }
      );
      if (count !== 1) return false;
      await ContractActivity.create({ employer_id: emp, contract_id: id, action: "REMINDED", actor_user_id: null }, { transaction });
      return true;
    });
    if (won) await emitContractEvent("REMINDED", { contractId: id });
  }
};

const revokeInactiveRecipients = async (now) => {
  const pending = await Contract.findAll({
    where: { status: { [Op.in]: ["SENT", "VIEWED", "SUBMITTED"] } },
    attributes: ["id", "employer_id", "audience_type"],
    include: [{ model: ContractRecipient, as: "contractRecipients", attributes: ["employee_id", "staffing_company_id"] }],
  });
  for (const c of pending) {
    const r = c.contractRecipients[0];
    if (!r) continue;
    if (await isRecipientActive(c.employer_id, c.audience_type, r.employee_id || r.staffing_company_id)) continue;
    const won = await sequelize.transaction(async (transaction) => {
      const [count] = await Contract.update(
        { status: "REVOKED", revoke_reason: AUTO_REVOKE_REASON, revoked_at: now, revoked_by: null },
        { where: { id: c.id, status: { [Op.in]: ["SENT", "VIEWED", "SUBMITTED"] } }, transaction }
      );
      if (count !== 1) return false;
      await ContractRecipient.update({ status: "REVOKED" }, { where: { contract_id: c.id }, transaction });
      await ContractActivity.create(
        { employer_id: c.employer_id, contract_id: c.id, action: "REVOKED", actor_user_id: null, meta: { reason: AUTO_REVOKE_REASON, auto: true } },
        { transaction }
      );
      return true;
    });
    if (won) await emitContractEvent("REVOKED", { contractId: c.id, auto: true, reason: AUTO_REVOKE_REASON });
  }
};

// Called directly by tests; `now` defaults to the current time.
const runContractJob = async ({ now = new Date() } = {}) => {
  await expireDue({ now });
  await sendReminders(now);
  await revokeInactiveRecipients(now);
};

// Started by server.js only (never by the app the tests load).
const startContractJob = () => {
  const cron = require("node-cron");
  return cron.schedule(SCHEDULE, () => {
    runContractJob().catch((err) => console.error("[contracts] hourly job failed", { error: err.message }));
  });
};

module.exports = { runContractJob, startContractJob, SCHEDULE, AUTO_REVOKE_REASON };

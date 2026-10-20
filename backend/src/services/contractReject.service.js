const Joi = require("joi");
const { sequelize, Contract, ContractRecipient, ContractActivity } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { fieldErrorsFromJoi } = require("../utils/fieldErrors");
const { required } = require("../validations/department.validation");
const { isRecipientActive } = require("./contractParties.service");
const { expireDue } = require("./contractExpiry.service");
const { findVisible } = require("./contractSigner.service");
const { contractItem } = require("./contract.service");
const { signerStateError } = require("./contractSign.service");
const { emitContractEvent } = require("./contractEvents");

// Reject (plan decisions 30, 37): final; HR sends a new contract. The reason rule is shared
// with HR revoke (standards §7.3 "Reject / Revoke").

const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
const reasonSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .min(10)
    .max(500)
    .pattern(EMOJI, { invert: true })
    .required()
    .messages({
      ...required("contractReasonRequired"),
      "string.min": "contractReasonMin",
      "string.max": "contractReasonMax",
      "string.pattern.invert.base": "noEmojis",
    }),
});

// → trimmed reason, or 400 VALIDATION_FAILED { reason }.
const checkReason = (body) => {
  const { error, value } = reasonSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new ErrorHandler("VALIDATION_FAILED", { errors: fieldErrorsFromJoi(error) });
  return value.reason;
};

// POST /my/contracts/:id/reject { reason }. Checks: 404, state, recipient active, reason.
const rejectContract = async (auth, id, body) => {
  await expireDue({ employerId: auth.employerId, contractId: id }).catch(() => {});
  const { contract } = await findVisible(auth, id);
  const stateError = signerStateError(contract);
  if (stateError) throw new ErrorHandler(stateError);
  const recipient = contract.contractRecipients[0];
  if (!(await isRecipientActive(auth.employerId, contract.audience_type, recipient.employee_id || recipient.staffing_company_id))) {
    throw new ErrorHandler("CONTRACT_RECIPIENT_INACTIVE");
  }
  const reason = checkReason(body);

  await sequelize.transaction(async (transaction) => {
    const locked = await Contract.findOne({ where: { id: contract.id }, transaction, lock: transaction.LOCK.UPDATE });
    const lockedError = signerStateError(locked);
    if (lockedError) throw new ErrorHandler(lockedError);
    await locked.update({ status: "REJECTED" }, { transaction });
    await ContractRecipient.update({ status: "DECLINED", reject_reason: reason }, { where: { id: recipient.id }, transaction });
    await ContractActivity.create(
      { employer_id: auth.employerId, contract_id: contract.id, recipient_id: recipient.id, action: "DECLINED", actor_user_id: auth.userId, meta: { reason } },
      { transaction }
    );
  });
  await emitContractEvent("REJECTED", { contractId: contract.id, reason });
  return contractItem((await findVisible(auth, id)).contract);
};

module.exports = { rejectContract, checkReason };

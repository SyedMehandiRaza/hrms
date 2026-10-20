const { Op } = require("sequelize");
const { Contract, ContractRecipient, Notification, User, HrmsAccount, Employee, StaffingCompany } = require("../models");
const { NOTIFICATIONS } = require("../constants/contractNotifications");
const { onContractEvent } = require("./contractEvents");
const { CURRENT_ACCOUNT_STATUSES } = require("./auth.service");
const { getMailConfig } = require("../config/mail");
const { fill } = require("../utils/i18n");
const { formatDate } = require("../utils/companyTime");
const mailer = require("./mailer");

// Contract notifications (plan decision 43): an in-app row (entity "contract") and an email
// in the receiver's language, after the action has committed. Failures are logged and never
// undo the action. A creator with no current account in the company gets nothing.

// Event → [notification type, receivers]. "signer" or "creator".
const PLAN = {
  SENT: [["CONTRACT_SENT", "signer"]],
  SIGNED: [["CONTRACT_SIGNED", "creator"]],
  REJECTED: [["CONTRACT_REJECTED", "creator"]],
  REMINDED: [["CONTRACT_EXPIRING", "signer"]],
  EXPIRED: [
    ["CONTRACT_EXPIRED", "creator"],
    ["CONTRACT_EXPIRED", "signer"],
  ],
  REVOKED: [["CONTRACT_REVOKED", "signer"]],
  // auto-revoke: same row type, its own wording (plan decision 43)
  REVOKED_AUTO: [["CONTRACT_REVOKED", "creator", "CONTRACT_REVOKED_AUTO"]],
  COMPLETED: [["CONTRACT_COMPLETED", "signer"]],
};

// Page per receiver (by access level in this company) + ?contract=<id>.
const SIGNER_PATHS = {
  EMPLOYEE: "/employee/my-contracts",
  GENERAL_EMPLOYEE: "/employee/my-contracts",
  ADMIN: "/admin/my-requests/contracts",
  SUB_ADMIN: "/admin/my-requests/contracts",
  STAFFING_COMPANY: "/staffing-company/contracts",
};
const CREATOR_PATH = "/admin/new-contracts";

const currentAccount = (userId, employerId) =>
  HrmsAccount.findOne({ where: { user_id: userId, employer_id: employerId, status: { [Op.in]: CURRENT_ACCOUNT_STATUSES } } });

const signerUserId = async (recipient) => {
  if (recipient.employee_id) return (await Employee.findByPk(recipient.employee_id, { paranoid: false, attributes: ["user_id"] }))?.user_id;
  return (await StaffingCompany.findByPk(recipient.staffing_company_id, { paranoid: false, attributes: ["user_id"] }))?.user_id;
};

const notifyOne = async ({ contract, recipient, type, role, textKey = type, params }) => {
  const userId = role === "creator" ? contract.created_by : await signerUserId(recipient);
  if (!userId) return;
  const account = await currentAccount(userId, contract.employer_id);
  if (!account) return; // e.g. the creator left: the activity still records the event
  const user = await User.findByPk(userId, { attributes: ["id", "email", "lang_key"] });
  if (!user) return;
  const lang = String(user.lang_key).toLowerCase() === "ar" ? "ar" : "en";
  const text = NOTIFICATIONS[textKey][lang];
  const title = fill(text.title, params).slice(0, 200);
  const body = fill(text.body, params);
  const path = role === "creator" ? CREATOR_PATH : SIGNER_PATHS[account.access_level] || "/employee/my-contracts";
  const link = `${getMailConfig().appUrl}${path}?contract=${contract.id}`;

  await Notification.create({ employer_id: contract.employer_id, user_id: user.id, type, title, body, entity_type: "contract", entity_id: contract.id });
  // Email after the row; a failed delivery is logged, never thrown.
  mailer.send({ to: user.email, lang: user.lang_key, template: "contract-notification", data: { title, body, link } }).catch((err) => {
    console.error("[contracts] notification email failed", { contractId: contract.id, type, error: err.message });
  });
};

const handle = async (event, { contractId, auto, reason }) => {
  const key = event === "REVOKED" && auto ? "REVOKED_AUTO" : event;
  const steps = PLAN[key];
  if (!steps) return;
  const contract = await Contract.findByPk(contractId, { paranoid: false });
  if (!contract) return;
  const recipient = await ContractRecipient.findOne({ where: { contract_id: contract.id } });
  const params = {
    name: contract.name,
    number: contract.reference_no || "",
    signBy: formatDate(contract.meta?.sign_by) || "",
    recipient: recipient?.recipient_name || "",
    reason: reason || contract.revoke_reason || recipient?.reject_reason || "",
  };
  for (const [type, role, textKey] of steps) {
    try {
      await notifyOne({ contract, recipient, type, role, textKey, params });
    } catch (err) {
      console.error("[contracts] notification failed", { contractId, type, error: err.message });
    }
  }
};

let registered = false;
const registerContractNotifications = () => {
  if (registered) return;
  registered = true;
  onContractEvent(handle);
};

module.exports = { registerContractNotifications, SIGNER_PATHS, CREATOR_PATH };

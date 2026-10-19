const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { sequelize, User, HrmsAccount, Employer } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const mailer = require("./mailer");
const {
  sha256,
  BCRYPT_COST,
  CURRENT_ACCOUNT_STATUSES,
  assertAccountUsable,
  issueSession,
  clearLockout,
} = require("./auth.service");

// Logins created by an admin (D20, D21; ADRs 0002, 0003). Later modules (employees,
// sub-admins, staffing companies) call:
//   await assertEmailFreeForNewAccount(email, employerId)            before creating the account
//   await issueLoginCredentials({ userId, accountId, transaction })  after creating it, and for "Resend"

// Temporary password + setup link are valid for 72 hours (ADR 0003).
const SETUP_TTL_MS = 72 * 60 * 60 * 1000;
const TEMP_PASSWORD_LENGTH = 12;

// No look-alike characters (0/O, 1/l/I) since the password is typed from an email.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%^&*?-_+=";
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

const pick = (chars) => chars[crypto.randomInt(chars.length)];

// Crypto-random password that always meets the password rule (standards §1): one
// character of each class, the rest from all classes, then shuffled (Fisher–Yates).
const generateTemporaryPassword = () => {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
};

// Setup-state columns of an account once its password is a real one (or none is pending).
const SETUP_CLEARED = {
  password_setup_required: false,
  password_setup_token_hash: null,
  password_setup_token_expires_at: null,
};

// ADR 0002: a person may hold only one current (ACTIVE or SUSPENDED, not deleted)
// account across all companies. Throws ACCOUNT_EMAIL_IN_OTHER_COMPANY (409) when the
// email already has one in a company other than `employerId`; ended accounts don't
// count. A current account in the same company is not this guard's concern (the caller
// decides between reactivating it and refusing a duplicate).
const assertEmailFreeForNewAccount = async (email, employerId, transaction) => {
  const normalized = String(email || "").trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalized }, attributes: ["id"], paranoid: false, transaction });
  if (!user) return;

  const elsewhere = await HrmsAccount.count({
    where: {
      user_id: user.id,
      employer_id: { [Op.ne]: employerId },
      status: { [Op.in]: CURRENT_ACCOUNT_STATUSES },
    },
    transaction,
  });
  if (elsewhere > 0) throw new ErrorHandler("ACCOUNT_EMAIL_IN_OTHER_COMPANY");
};

// True while the person's stored password is a temporary one that hasn't been replaced:
// some account of theirs (any company, even ended) still has a pending setup token.
// A setup token exists only between issuing a temporary password and replacing it.
const hasPendingTemporaryPassword = async (userId, transaction) =>
  (await HrmsAccount.count({
    where: { user_id: userId, password_setup_required: true, password_setup_token_hash: { [Op.ne]: null } },
    paranoid: false,
    transaction,
  })) > 0;

// Gives the account a way to log in and emails the person (ADR 0003). Calling it again
// is "Resend".
//   - The person has no password yet, or only a temporary one that was never replaced:
//     a new temporary password and setup token are generated (valid 72 h); the previous
//     ones stop working, including a link sent for another (ended) login.
//     Email: welcome-temp-password { email, temporaryPassword, setupToken }.
//   - The person already has their own password (e.g. from another company, ADR 0002):
//     nothing is generated and the account is not forced to change it.
//     Email: welcome-existing-password { email }.
// Runs in the caller's transaction when given one. The email goes out only after the
// commit; a failed send is logged, not thrown (the rows are saved and Resend exists).
// Returns { temporaryPassword: boolean }.
const issueLoginCredentials = async ({ userId, accountId, transaction }) => {
  const work = async (t) => {
    const user = await User.scope("withPassword").findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    const account = await HrmsAccount.findOne({
      where: { id: accountId, user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user || !account) throw new Error("issueLoginCredentials: no such account for this person");

    const issueTemp = !user.password || (await hasPendingTemporaryPassword(user.id, t));

    let mail;
    if (issueTemp) {
      const temporaryPassword = generateTemporaryPassword();
      const setupToken = crypto.randomBytes(32).toString("base64url");
      const now = new Date();

      await user.update({ password: await bcrypt.hash(temporaryPassword, BCRYPT_COST) }, { transaction: t });
      // Links sent for the person's other logins die with the old temporary password.
      await HrmsAccount.update(
        { password_setup_token_hash: null, password_setup_token_expires_at: null },
        { where: { user_id: user.id, id: { [Op.ne]: account.id } }, paranoid: false, transaction: t }
      );
      await account.update(
        {
          password_setup_required: true,
          password_setup_token_hash: sha256(setupToken),
          password_setup_token_expires_at: new Date(now.getTime() + SETUP_TTL_MS),
          password_set_at: null,
        },
        { transaction: t }
      );
      mail = { template: "welcome-temp-password", data: { email: user.email, temporaryPassword, setupToken } };
    } else {
      await account.update(SETUP_CLEARED, { transaction: t });
      mail = { template: "welcome-existing-password", data: { email: user.email } };
    }

    t.afterCommit(async () => {
      try {
        await mailer.send({ to: user.email, lang: user.lang_key, ...mail });
      } catch (err) {
        console.error("[auth] welcome email failed", { userId: user.id, template: mail.template, error: err.message });
      }
    });

    return { temporaryPassword: issueTemp };
  };

  return transaction ? work(transaction) : sequelize.transaction(work);
};

// The person now has a password of their own (setup link now; change-password in
// ticket 09): every login of theirs stops requiring a change and loses any setup
// token, and this account records when the password was set.
const markPasswordSet = async ({ userId, accountId }, transaction) => {
  await HrmsAccount.update(SETUP_CLEARED, { where: { user_id: userId }, paranoid: false, transaction });
  await HrmsAccount.update({ password_set_at: new Date() }, { where: { id: accountId }, transaction });
};

// ---------- POST /auth/setup-password ----------

// The account the link belongs to: matching token, still pending and not expired.
// Deleted accounts are included so the status checks answer for them (D9).
const findSetupAccount = (tokenHash, now, transaction) =>
  HrmsAccount.findOne({
    where: {
      password_setup_token_hash: tokenHash,
      password_setup_required: true,
      password_setup_token_expires_at: { [Op.gt]: now },
    },
    include: [{ model: Employer, as: "employer", paranoid: false, required: false }],
    paranoid: false,
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });

// Sets the person's own password with the setup link and logs them in (ADR 0003).
// Unknown, used, superseded or expired links → AUTH_SETUP_LINK_INVALID. The person,
// account and company must be usable like at login (AUTH_ACCOUNT_INACTIVE /
// AUTH_COMPANY_INACTIVE). The temporary password can't be kept (AUTH_PASSWORD_SAME).
// In one transaction: password saved, setup state cleared on every login of the person,
// lockout cleared, session issued.
const setupPassword = async ({ token, newPassword, ip, userAgent }) => {
  const invalid = () => new ErrorHandler("AUTH_SETUP_LINK_INVALID");
  if (typeof token !== "string" || !token) throw invalid();
  const tokenHash = sha256(token);

  const found = await findSetupAccount(tokenHash, new Date());
  if (!found) throw invalid();
  const user = await User.scope("withPassword").findByPk(found.user_id, { paranoid: false });
  assertAccountUsable({ account: found, user, employer: found.employer });

  if (user.password && (await bcrypt.compare(newPassword, user.password))) {
    throw new ErrorHandler("AUTH_PASSWORD_SAME", { errors: { newPassword: "AUTH_PASSWORD_SAME" } });
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  return sequelize.transaction(async (transaction) => {
    // Re-read under a lock: two uses of one link can't both succeed.
    const account = await findSetupAccount(tokenHash, new Date(), transaction);
    if (!account) throw invalid();

    await user.update({ password: passwordHash }, { transaction });
    await markPasswordSet({ userId: user.id, accountId: account.id }, transaction);
    await clearLockout(user, transaction);

    const tokens = await issueSession({ account, ip, userAgent }, transaction);
    await account.update({ last_login_at: new Date() }, { transaction });
    return { ...tokens, mustChangePassword: false };
  });
};

module.exports = {
  issueLoginCredentials,
  setupPassword,
  assertEmailFreeForNewAccount,
  generateTemporaryPassword,
  markPasswordSet,
  SETUP_TTL_MS,
};

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { sequelize, User, HrmsAccount, PasswordResetOtp } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const mailer = require("./mailer");
const { sha256, revokeSessions, clearLockout, BCRYPT_COST } = require("./auth.service");

// Forgot password → verify code → reset (D14, D18; ADR 0001).

const ACTIVE = "ACTIVE";
const MINUTE = 60 * 1000;
const OTP_TTL_MS = 10 * MINUTE;
const MAX_OTP_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS = 15 * MINUTE;
const RESEND_GAP_MS = MINUTE;
const RESEND_WINDOW_MS = 60 * MINUTE;
const MAX_RESENDS_PER_WINDOW = 5;

// ---------- resend throttle ----------

// Request times per (lowercased) email, known or not, kept in memory like the per-IP
// rate limits (D11): one map treats unknown emails exactly like known ones and needs no
// table. It resets when the server restarts. Old entries are swept once a minute.
const requestsByEmail = new Map();
let lastSweep = 0;

const sweep = (now) => {
  if (now - lastSweep < MINUTE) return;
  lastSweep = now;
  for (const [key, times] of requestsByEmail) {
    if (!times.length || now - times[times.length - 1] >= RESEND_WINDOW_MS) requestsByEmail.delete(key);
  }
};

// Throws AUTH_OTP_RESEND_TOO_SOON within 60 s of the last request or after 5 requests in
// the last hour; otherwise records this request. Synchronous, so two parallel requests
// can't both pass.
const takeResendSlot = (email) => {
  const now = Date.now();
  sweep(now);
  const key = String(email).trim().toLowerCase();
  const times = (requestsByEmail.get(key) || []).filter((t) => now - t < RESEND_WINDOW_MS);
  const last = times[times.length - 1];
  if ((last !== undefined && now - last < RESEND_GAP_MS) || times.length >= MAX_RESENDS_PER_WINDOW) {
    requestsByEmail.set(key, times);
    throw new ErrorHandler("AUTH_OTP_RESEND_TOO_SOON");
  }
  times.push(now);
  requestsByEmail.set(key, times);
};

// ---------- helpers ----------

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const sameHash = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// A code is sent only to a person who can still log in somewhere: the person is ACTIVE
// and not deleted, and has at least one ACTIVE login (a SUSPENDED or ended login can't
// log in, so resetting its password would not help).
const findEligibleUser = async (email) => {
  const user = await User.findOne({ where: { email, user_status: ACTIVE } });
  if (!user) return null;
  const active = await HrmsAccount.count({ where: { user_id: user.id, status: ACTIVE } });
  return active > 0 ? user : null;
};

// Voids every outstanding code and reset token of the person.
const voidOutstanding = async (userId, now, transaction) => {
  await PasswordResetOtp.update(
    { consumed_at: now },
    { where: { user_id: userId, consumed_at: null }, transaction }
  );
  await PasswordResetOtp.update(
    { reset_token_hash: null, reset_token_expires_at: null },
    { where: { user_id: userId, reset_token_hash: { [Op.ne]: null } }, transaction }
  );
};

// ---------- POST /auth/forgot-password ----------

// Always answers the same way (AUTH_RESET_SENT) whether or not the email is known; a
// code is generated and hashed either way so both paths do the same work. The email is
// sent without waiting, so a slow or failing mail server neither changes the timing nor
// turns a known email into an error.
const requestReset = async ({ email }) => {
  takeResendSlot(email);

  const code = generateCode();
  const otpHash = sha256(code);

  const user = await findEligibleUser(email);
  if (!user) return;

  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await voidOutstanding(user.id, now, transaction);
    await PasswordResetOtp.create(
      { user_id: user.id, otp_hash: otpHash, expires_at: new Date(now.getTime() + OTP_TTL_MS), attempts: 0 },
      { transaction }
    );
  });

  mailer
    .send({ to: user.email, lang: user.lang_key, template: "reset-otp", data: { code } })
    .catch((err) => console.error("[auth] reset code email failed", { userId: user.id, error: err.message }));
};

// ---------- POST /auth/verify-otp ----------

// Checks the latest unused code of the person. A wrong code counts one attempt; the
// fifth wrong one burns the code (AUTH_OTP_ATTEMPTS_EXCEEDED). The right code is used up
// and exchanged for a single-use reset token (15 minutes).
const verifyOtp = async ({ email, otp }) => {
  const otpHash = sha256(otp);
  const user = await User.findOne({ where: { email }, attributes: ["id"] });
  if (!user) throw new ErrorHandler("AUTH_OTP_INVALID");

  const outcome = await sequelize.transaction(async (transaction) => {
    const now = new Date();
    const row = await PasswordResetOtp.findOne({
      where: { user_id: user.id, consumed_at: null },
      order: [["created_at", "DESC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!row || new Date(row.expires_at) <= now) return { error: "AUTH_OTP_INVALID" };

    if (!sameHash(otpHash, row.otp_hash)) {
      const attempts = row.attempts + 1;
      const exceeded = attempts >= MAX_OTP_ATTEMPTS;
      await row.update({ attempts, ...(exceeded ? { consumed_at: now } : {}) }, { transaction });
      return { error: exceeded ? "AUTH_OTP_ATTEMPTS_EXCEEDED" : "AUTH_OTP_INVALID" };
    }

    const resetToken = crypto.randomBytes(32).toString("base64url");
    await row.update(
      {
        consumed_at: now,
        reset_token_hash: sha256(resetToken),
        reset_token_expires_at: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      },
      { transaction }
    );
    return { resetToken };
  });

  // Thrown after the transaction so a wrong attempt is still saved.
  if (outcome.error) throw new ErrorHandler(outcome.error);
  return { resetToken: outcome.resetToken };
};

// ---------- POST /auth/reset-password ----------

const findResetRow = (tokenHash, now, transaction) =>
  PasswordResetOtp.findOne({
    where: { reset_token_hash: tokenHash, reset_token_expires_at: { [Op.gt]: now } },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });

// Sets the new password with a valid reset token. In one transaction: the password is
// saved, every outstanding code/token is voided, every session of the person (on every
// login) is ended and any lockout is cleared.
const resetPassword = async ({ resetToken, newPassword }) => {
  const invalid = () => new ErrorHandler("AUTH_RESET_TOKEN_INVALID");
  if (typeof resetToken !== "string" || !resetToken) throw invalid();
  const tokenHash = sha256(resetToken);

  const found = await findResetRow(tokenHash, new Date());
  if (!found) throw invalid();
  const user = await User.scope("withPassword").findByPk(found.user_id);
  if (!user) throw invalid();

  if (user.password && (await bcrypt.compare(newPassword, user.password))) {
    throw new ErrorHandler("AUTH_PASSWORD_SAME", { errors: { newPassword: "AUTH_PASSWORD_SAME" } });
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await sequelize.transaction(async (transaction) => {
    // Re-read under a lock: two resets with one token can't both succeed.
    const now = new Date();
    const row = await findResetRow(tokenHash, now, transaction);
    if (!row) throw invalid();

    await user.update({ password: passwordHash }, { transaction });
    await voidOutstanding(user.id, now, transaction);

    const accounts = await HrmsAccount.findAll({
      where: { user_id: user.id },
      attributes: ["id"],
      paranoid: false,
      transaction,
    });
    if (accounts.length) {
      await revokeSessions({ hrms_account_id: { [Op.in]: accounts.map((a) => a.id) } }, transaction);
    }
    await clearLockout(user, transaction);
  });
};

module.exports = { requestReset, verifyOtp, resetPassword };

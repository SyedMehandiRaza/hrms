const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { sequelize, User, HrmsSession } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { describeDevice } = require("../utils/userAgent");
const {
  BCRYPT_COST,
  isLocked,
  registerFailedPassword,
  clearLockout,
  revokeSessions,
} = require("./auth.service");
const { markPasswordSet } = require("./credentials.service");

// A logged-in person's own password and sessions (D10, D14, D15, D24). `auth` is req.auth.

const ACTIVE = "ACTIVE";

// ---------- POST /auth/change-password ----------

// Ends the session making the request (the person is locked out, D10).
const endCurrentSession = (auth) => revokeSessions({ id: auth.sessionId, hrms_account_id: auth.accountId });

// Order: lock → current password → same as current → save. A wrong current password
// counts toward the same lockout as login; the failure that reaches the limit (or any
// attempt while locked) ends the current session and answers AUTH_ACCOUNT_LOCKED.
// On success, in one transaction: password saved, lockout cleared and any "must change
// password" state cleared (a temporary password counts as replaced). Sessions are never
// ended here: the UI asks which ones to end (D15).
const changePassword = async (auth, { currentPassword, newPassword }) => {
  const user = await User.scope("withPassword").findByPk(auth.userId);
  if (!user) throw new ErrorHandler("AUTH_REQUIRED");

  if (isLocked(user)) {
    await endCurrentSession(auth);
    throw new ErrorHandler("AUTH_ACCOUNT_LOCKED");
  }

  const matches = !!user.password && (await bcrypt.compare(currentPassword, user.password));
  if (!matches) {
    const { locked } = await registerFailedPassword(user);
    if (locked) {
      await endCurrentSession(auth);
      throw new ErrorHandler("AUTH_ACCOUNT_LOCKED");
    }
    throw new ErrorHandler("AUTH_CURRENT_PASSWORD_WRONG", {
      errors: { currentPassword: "AUTH_CURRENT_PASSWORD_WRONG" },
    });
  }

  if (await bcrypt.compare(newPassword, user.password)) {
    throw new ErrorHandler("AUTH_PASSWORD_SAME", { errors: { newPassword: "AUTH_PASSWORD_SAME" } });
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await sequelize.transaction(async (transaction) => {
    await user.update({ password: passwordHash }, { transaction });
    await clearLockout(user, transaction);
    await markPasswordSet({ userId: user.id, accountId: auth.accountId }, transaction);
  });
};

// ---------- sessions ----------

// The caller's sessions that can still be used: ACTIVE and not expired, on the
// account they are logged in with (sessions of other accounts of the person never show).
const activeSessionsWhere = (auth, now = new Date()) => ({
  hrms_account_id: auth.accountId,
  status: ACTIVE,
  expires_at: { [Op.gt]: now },
});

// GET /auth/sessions: newest use first; `current` marks the session making the request.
const listSessions = async (auth) => {
  const sessions = await HrmsSession.findAll({
    where: activeSessionsWhere(auth),
    order: [
      ["last_used_at", "DESC"],
      ["created_at", "DESC"],
    ],
  });
  return sessions.map((s) => ({
    id: s.id,
    device: describeDevice(s.user_agent),
    ip: s.ip_address,
    created_at: s.createdAt,
    last_used_at: s.last_used_at,
    current: s.id === auth.sessionId,
  }));
};

// POST /auth/sessions/revoke: { all: true } ends every other active session; otherwise
// every listed id must be one of the caller's active sessions (else NOT_FOUND) and not
// the current one (SESSION_REVOKE_CURRENT). Ids are all checked before anything ends,
// so a bad id ends nothing. Returns { revoked: n }.
const revokeOwnSessions = async (auth, { all, sessionIds }) => {
  if (all) {
    const revoked = await revokeSessions({ ...activeSessionsWhere(auth), id: { [Op.ne]: auth.sessionId } });
    return { revoked };
  }

  const ids = [...new Set(sessionIds)];
  if (ids.includes(auth.sessionId)) throw new ErrorHandler("SESSION_REVOKE_CURRENT");

  const revoked = await sequelize.transaction(async (transaction) => {
    const where = { ...activeSessionsWhere(auth), id: { [Op.in]: ids } };
    const found = await HrmsSession.count({ where, transaction });
    if (found !== ids.length) throw new ErrorHandler("NOT_FOUND");
    return revokeSessions(where, transaction);
  });
  return { revoked };
};

module.exports = { changePassword, listSessions, revokeOwnSessions };

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op, UniqueConstraintError } = require("sequelize");
const {
  sequelize,
  User,
  HrmsAccount,
  HrmsSession,
  Employer,
  CompanyTimeSetting,
  FinancialYear,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { getAuthConfig } = require("../config/auth");
const { ACCESS_LEVELS, PANEL_BY_ACCESS_LEVEL } = require("../constants/accessLevels");
const { loadPermissions } = require("./permission.service");

const ACTIVE = "ACTIVE";
const REVOKED = "REVOKED";
const EXPIRED = "EXPIRED";

const CURRENT_ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED"];

// Password hashing cost (standards §1).
const BCRYPT_COST = 12;

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Compared against when the email is unknown, so both paths cost one bcrypt check (D8).
let dummyHashPromise;
const dummyHash = () => {
  dummyHashPromise = dummyHashPromise || bcrypt.hash(crypto.randomBytes(16).toString("hex"), 12);
  return dummyHashPromise;
};

// Server log for failed logins (D26). Never includes the password.
const logFailedLogin = ({ email, ip, reason }) => {
  console.warn("[auth] login failed", { email, ip, reason });
};

// Lockout (D10): 5 consecutive wrong passwords lock the person for 15 minutes.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const isLocked = (user, now = new Date()) => !!user.locked_until && new Date(user.locked_until) > now;

// Counts one wrong password (login now; change-password reuses it). A lock that has
// already passed starts the count again from one. The failure that reaches the limit
// sets locked_until and returns { locked: true }; the caller answers AUTH_ACCOUNT_LOCKED.
const registerFailedPassword = async (user, transaction) => {
  const now = new Date();
  const lockPassed = !!user.locked_until && !isLocked(user, now);
  const attempts = (lockPassed ? 0 : user.failed_login_attempts || 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  await user.update(
    {
      failed_login_attempts: attempts,
      locked_until: locked ? new Date(now.getTime() + LOCK_MS) : lockPassed ? null : user.locked_until,
    },
    { transaction }
  );
  return { locked };
};

// Clears the counter and any lock (successful login now; password reset reuses it).
const clearLockout = async (user, transaction) => {
  if (!user.failed_login_attempts && !user.locked_until) return;
  await user.update({ failed_login_attempts: 0, locked_until: null }, { transaction });
};

// Soft-deleted (paranoid) row loaded with paranoid: false.
const isDeleted = (row) => row.isSoftDeleted();

// Account/person/company checks shared by login, refresh and requireAuth (D9, D34).
// An account is usable only while ACTIVE and not deleted; SUSPENDED and ended
// accounts are AUTH_ACCOUNT_INACTIVE. The company must be ACTIVE (not INACTIVE/BANNED).
const assertAccountUsable = ({ account, user, employer }) => {
  if (!user || isDeleted(user) || user.user_status !== ACTIVE) throw new ErrorHandler("AUTH_ACCOUNT_INACTIVE");
  if (!account || isDeleted(account) || account.status !== ACTIVE) throw new ErrorHandler("AUTH_ACCOUNT_INACTIVE");
  if (!employer || isDeleted(employer) || employer.employer_status !== ACTIVE) {
    throw new ErrorHandler("AUTH_COMPANY_INACTIVE");
  }
};

// Creates a session row and the tokens that go with it.
//   access token  JWT { sub: user id, acc: account id, emp: employer id, sid: session id, jti }
//   refresh token 256-bit random, stored only as its SHA-256 (refresh_token_hash)
//   access_token_hash = SHA-256 of the access token's jti (the token itself is never stored)
const issueSession = async ({ account, ip, userAgent }, transaction) => {
  const { accessSecret, accessTtl, refreshTtlMs } = getAuthConfig();
  const sessionId = crypto.randomUUID();
  const jti = crypto.randomUUID();
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  const now = new Date();

  await HrmsSession.create(
    {
      id: sessionId,
      hrms_account_id: account.id,
      access_token_hash: sha256(jti),
      refresh_token_hash: sha256(refreshToken),
      status: ACTIVE,
      user_agent: userAgent || null,
      ip_address: ip ? String(ip).slice(0, 80) : null,
      expires_at: new Date(now.getTime() + refreshTtlMs),
      last_used_at: now,
    },
    { transaction }
  );

  const accessToken = jwt.sign({ acc: account.id, emp: account.employer_id, sid: sessionId }, accessSecret, {
    subject: account.user_id,
    expiresIn: accessTtl,
    jwtid: jti,
  });

  return { accessToken, refreshToken, refreshTtlMs };
};

// Ends sessions that are not being rotated (logout, reuse detection, and later
// deactivation / password reset). The refresh hash is replaced with a random one so a
// late cookie is simply unknown (401) instead of looking like a rotated token being
// reused, which would revoke every session of the account. Only rotation keeps the hash.
const revokeSessions = async (where, transaction) => {
  const sessions = await HrmsSession.findAll({ where: { ...where, status: ACTIVE }, attributes: ["id"], transaction });
  const now = new Date();
  for (const session of sessions) {
    await HrmsSession.update(
      { status: REVOKED, revoked_at: now, refresh_token_hash: sha256(crypto.randomBytes(32)) },
      { where: { id: session.id, status: ACTIVE }, transaction }
    );
  }
  return sessions.length;
};

// POST /auth/login. Order (D9): credentials → lock → person status → current account
// → company status → temporary-password expiry → success.
const login = async ({ email, password, ip, userAgent }) => {
  const user = await User.scope("withPassword").findOne({ where: { email } });
  const matches = await bcrypt.compare(password, user?.password || (await dummyHash()));

  // A locked person gets 423 whatever the password; the comparison above still ran,
  // so a locked account answers in the same time. Unknown emails are never locked.
  if (user && isLocked(user)) {
    logFailedLogin({ email, ip, reason: "AUTH_ACCOUNT_LOCKED" });
    throw new ErrorHandler("AUTH_ACCOUNT_LOCKED");
  }

  if (!user || !user.password || !matches) {
    logFailedLogin({ email, ip, reason: user ? "WRONG_PASSWORD" : "UNKNOWN_EMAIL" });
    if (user) {
      const { locked } = await registerFailedPassword(user);
      if (locked) throw new ErrorHandler("AUTH_ACCOUNT_LOCKED");
    }
    throw new ErrorHandler("AUTH_INVALID_CREDENTIALS");
  }

  await clearLockout(user);

  // One current account per person (ADR 0002): ACTIVE or SUSPENDED, not deleted.
  const account = await HrmsAccount.findOne({
    where: { user_id: user.id, status: { [Op.in]: CURRENT_ACCOUNT_STATUSES } },
    include: [{ model: Employer, as: "employer", required: false }],
  });

  try {
    assertAccountUsable({ account, user, employer: account?.employer });
  } catch (err) {
    logFailedLogin({ email, ip, reason: err.code });
    throw err;
  }

  // Ticket 08: an expired temporary password (password_setup_token_expires_at) → AUTH_SETUP_EXPIRED.

  const tokens = await sequelize.transaction(async (transaction) => {
    const issued = await issueSession({ account, ip, userAgent }, transaction);
    await account.update({ last_login_at: new Date() }, { transaction });
    return issued;
  });

  return { ...tokens, mustChangePassword: account.password_setup_required };
};

// ---------- sign up (D4, D6, D19, D20; ADR 0002) ----------

// A new company starts in Saudi time with the financial year starting in January.
const SIGNUP_TIMEZONE = "Asia/Riyadh";
const SIGNUP_FY_START_MONTH = 1;

const yearIn = (timeZone, date) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date));

// An email that is already registered may sign up again only when the person has no
// current account anywhere (ADR 0002) and proves it is them with their existing
// password; the person record is then reused with its password unchanged. A person
// with no accounts at all is treated the same way. Everything else is AUTH_EMAIL_TAKEN:
//   - a deleted or non-ACTIVE person record (login would refuse them anyway);
//   - a person who already owns a company (employers.user_id is unique);
//   - no stored password, or a different one.
const assertEmailReusable = async (user, password) => {
  const taken = () => new ErrorHandler("AUTH_EMAIL_TAKEN");
  if (isDeleted(user) || user.user_status !== ACTIVE) throw taken();

  const current = await HrmsAccount.count({ where: { user_id: user.id, status: { [Op.in]: CURRENT_ACCOUNT_STATUSES } } });
  if (current > 0) throw taken();

  const owned = await Employer.count({ where: { user_id: user.id }, paranoid: false });
  if (owned > 0) throw taken();

  if (!user.password || !(await bcrypt.compare(password, user.password))) throw taken();
};

// POST /auth/signup. One transaction creates (or reuses) the person, then the company,
// its time settings, the current financial year (OPEN) and the owner's ADMIN account,
// and logs in with a session exactly like login. No roles are created (D6).
const signup = async ({ companyName, name, email, phone, password, ip, userAgent }) => {
  const existing = await User.scope("withPassword").findOne({ where: { email }, paranoid: false });
  if (existing) await assertEmailReusable(existing, password);
  const passwordHash = existing ? null : await bcrypt.hash(password, BCRYPT_COST);

  let created;
  try {
    created = await sequelize.transaction(async (transaction) => {
      const now = new Date();
      const user =
        existing ||
        (await User.create({ name, email, password: passwordHash, signup_by: "EMAIL" }, { transaction }));

      const employer = await Employer.create(
        { user_id: user.id, company_name: companyName, company_phone_number: phone || null, employer_status: ACTIVE },
        { transaction }
      );
      await CompanyTimeSetting.create(
        { employer_id: employer.id, timezone: SIGNUP_TIMEZONE, fy_start_month: SIGNUP_FY_START_MONTH },
        { transaction }
      );

      const year = yearIn(SIGNUP_TIMEZONE, now);
      await FinancialYear.create(
        {
          employer_id: employer.id,
          year_key: year,
          label: `FY ${year}`,
          start_date: `${year}-01-01`,
          end_date: `${year}-12-31`,
          status: "OPEN",
          opened_at: now,
        },
        { transaction }
      );

      const account = await HrmsAccount.create(
        {
          user_id: user.id,
          employer_id: employer.id,
          access_level: ACCESS_LEVELS.ADMIN,
          status: ACTIVE,
          password_setup_required: false,
          password_set_at: now,
          last_login_at: now,
        },
        { transaction }
      );

      const tokens = await issueSession({ account, ip, userAgent }, transaction);
      return { account, tokens };
    });
  } catch (err) {
    // Two sign ups with the same email at once: the loser hits users.email or
    // employers.user_id.
    if (err instanceof UniqueConstraintError) throw new ErrorHandler("AUTH_EMAIL_TAKEN");
    throw err;
  }

  const { account, tokens } = created;
  const permissions = await loadPermissions({
    accessLevel: account.access_level,
    roleId: account.role_id,
    employerId: account.employer_id,
  });
  const me = await getMe({ accountId: account.id, employerId: account.employer_id, permissions });

  return { ...tokens, mustChangePassword: account.password_setup_required, me };
};

// Loads a session with its account, person and company in one query.
const findSessionWithAccount = (where, transaction) =>
  HrmsSession.findOne({
    where,
    transaction,
    include: [
      {
        model: HrmsAccount,
        as: "hrmsAccount",
        paranoid: false,
        required: true,
        include: [
          { model: User, as: "user", paranoid: false, required: true },
          { model: Employer, as: "employer", paranoid: false, required: true },
        ],
      },
    ],
  });

// POST /auth/refresh. Rotates the refresh token: the presented session is revoked and a
// new one (fresh 7 days) is created. A rotated token presented again ends every session
// of the account (D13).
const refresh = async ({ refreshToken, ip, userAgent }) => {
  if (!refreshToken) throw new ErrorHandler("AUTH_REFRESH_INVALID");

  const session = await findSessionWithAccount({ refresh_token_hash: sha256(refreshToken) });
  if (!session) throw new ErrorHandler("AUTH_REFRESH_INVALID");

  if (session.status === REVOKED) {
    await revokeSessions({ hrms_account_id: session.hrms_account_id });
    throw new ErrorHandler("AUTH_REFRESH_INVALID");
  }
  if (session.status !== ACTIVE) throw new ErrorHandler("AUTH_REFRESH_INVALID");
  if (new Date(session.expires_at) <= new Date()) {
    await session.update({ status: EXPIRED });
    throw new ErrorHandler("AUTH_REFRESH_INVALID");
  }

  const account = session.hrmsAccount;
  assertAccountUsable({ account, user: account.user, employer: account.employer });

  const outcome = await sequelize.transaction(async (transaction) => {
    // Conditional update: two concurrent refreshes with one token can't both rotate.
    const [rotated] = await HrmsSession.update(
      { status: REVOKED, revoked_at: new Date() },
      { where: { id: session.id, status: ACTIVE }, transaction }
    );
    if (rotated === 0) return null;
    return issueSession({ account, ip, userAgent }, transaction);
  });

  if (!outcome) {
    await revokeSessions({ hrms_account_id: account.id });
    throw new ErrorHandler("AUTH_REFRESH_INVALID");
  }
  return outcome;
};

// POST /auth/logout. Ends the cookie's session if it is still active; never fails.
const logout = async ({ refreshToken }) => {
  if (!refreshToken) return;
  await revokeSessions({ refresh_token_hash: sha256(refreshToken) });
};

// Used by requireAuth on every request: re-checks session, account, person and company
// (D12) and loads the role's permissions fresh (D34).
const resolveAccessToken = async (claims) => {
  const { sub, acc, emp, sid } = claims || {};
  if (![sub, acc, emp, sid].every((v) => typeof v === "string" && v)) throw new ErrorHandler("AUTH_REQUIRED");

  const session = await findSessionWithAccount({ id: sid });
  if (!session || session.status !== ACTIVE) throw new ErrorHandler("AUTH_REQUIRED");

  const account = session.hrmsAccount;
  if (account.id !== acc || account.user_id !== sub || account.employer_id !== emp) {
    throw new ErrorHandler("AUTH_REQUIRED");
  }
  assertAccountUsable({ account, user: account.user, employer: account.employer });

  const permissions = await loadPermissions({
    accessLevel: account.access_level,
    roleId: account.role_id,
    employerId: account.employer_id,
  });

  return {
    userId: account.user_id,
    accountId: account.id,
    employerId: account.employer_id,
    sessionId: session.id,
    accessLevel: account.access_level,
    roleId: account.role_id,
    permissions,
  };
};

// GET /auth/me (D23).
const getMe = async (auth) => {
  const account = await HrmsAccount.findOne({
    where: { id: auth.accountId, employer_id: auth.employerId },
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "lang_key"] },
      {
        model: Employer,
        as: "employer",
        attributes: ["id", "company_name", "company_logo"],
        include: [{ model: CompanyTimeSetting, as: "companyTimeSetting", attributes: ["timezone"] }],
      },
    ],
  });
  if (!account) throw new ErrorHandler("AUTH_REQUIRED");

  const { user, employer } = account;
  return {
    user: { id: user.id, name: user.name, email: user.email, lang_key: user.lang_key },
    account: { id: account.id, access_level: account.access_level, panel: PANEL_BY_ACCESS_LEVEL[account.access_level] },
    company: {
      id: employer.id,
      name: employer.company_name,
      logo: employer.company_logo,
      timezone: employer.companyTimeSetting ? employer.companyTimeSetting.timezone : null,
      currency: "SAR",
    },
    mustChangePassword: account.password_setup_required,
    permissions: auth.permissions,
  };
};

module.exports = {
  login,
  signup,
  refresh,
  logout,
  resolveAccessToken,
  getMe,
  revokeSessions,
  sha256,
  isLocked,
  registerFailedPassword,
  clearLockout,
  BCRYPT_COST,
};

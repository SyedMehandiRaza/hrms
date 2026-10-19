const authService = require("../services/auth.service");
const passwordResetService = require("../services/passwordReset.service");
const credentialsService = require("../services/credentials.service");
const securityService = require("../services/security.service");
const { translate } = require("../utils/i18n");
const { REFRESH_COOKIE, refreshCookieOptions } = require("../config/auth");

const clientInfo = (req) => ({ ip: req.ip, userAgent: req.get("user-agent") });

const setRefreshCookie = (res, refreshToken, refreshTtlMs) =>
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions(), maxAge: refreshTtlMs });

const login = async (req, res) => {
  const { accessToken, refreshToken, refreshTtlMs, mustChangePassword } = await authService.login({
    ...req.body,
    ...clientInfo(req),
  });
  setRefreshCookie(res, refreshToken, refreshTtlMs);
  res.json({ success: true, data: { accessToken, mustChangePassword } });
};

// 201 with the login data plus the current user (same shape as GET /auth/me), so the
// UI can go straight to the dashboard without a second call.
const signup = async (req, res) => {
  const { accessToken, refreshToken, refreshTtlMs, mustChangePassword, me } = await authService.signup({
    ...req.body,
    ...clientInfo(req),
  });
  setRefreshCookie(res, refreshToken, refreshTtlMs);
  res.status(201).json({ success: true, data: { accessToken, mustChangePassword, me } });
};

const refresh = async (req, res) => {
  const { accessToken, refreshToken, refreshTtlMs } = await authService.refresh({
    refreshToken: req.cookies?.[REFRESH_COOKIE],
    ...clientInfo(req),
  });
  setRefreshCookie(res, refreshToken, refreshTtlMs);
  res.json({ success: true, data: { accessToken } });
};

const logout = async (req, res) => {
  await authService.logout({ refreshToken: req.cookies?.[REFRESH_COOKIE] });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.json({ success: true });
};

const me = async (req, res) => {
  res.json({ success: true, data: await authService.getMe(req.auth) });
};

// Always 200 with the neutral AUTH_RESET_SENT message, known email or not (ADR 0001):
// { success: true, code: "AUTH_RESET_SENT", message }.
const forgotPassword = async (req, res) => {
  await passwordResetService.requestReset(req.body);
  res.json({ success: true, code: "AUTH_RESET_SENT", message: translate("AUTH_RESET_SENT", req.lang) });
};

// 200 { success: true, data: { resetToken } }.
const verifyOtp = async (req, res) => {
  res.json({ success: true, data: await passwordResetService.verifyOtp(req.body) });
};

const resetPassword = async (req, res) => {
  await passwordResetService.resetPassword(req.body);
  res.json({ success: true });
};

// Setup link (ADR 0003): sets the password and logs in; same response as login.
const setupPassword = async (req, res) => {
  const { accessToken, refreshToken, refreshTtlMs, mustChangePassword } = await credentialsService.setupPassword({
    ...req.body,
    ...clientInfo(req),
  });
  setRefreshCookie(res, refreshToken, refreshTtlMs);
  res.json({ success: true, data: { accessToken, mustChangePassword } });
};

// 200 { success: true }. Sessions are not ended (the UI offers the session picker).
const changePassword = async (req, res) => {
  await securityService.changePassword(req.auth, req.body);
  res.json({ success: true });
};

// 200 { success: true, data: [{ id, device, ip, created_at, last_used_at, current }] }.
const listSessions = async (req, res) => {
  res.json({ success: true, data: await securityService.listSessions(req.auth) });
};

// 200 { success: true, data: { revoked } }.
const revokeSessions = async (req, res) => {
  res.json({ success: true, data: await securityService.revokeOwnSessions(req.auth, req.body) });
};

module.exports = {
  login,
  signup,
  refresh,
  logout,
  me,
  forgotPassword,
  verifyOtp,
  resetPassword,
  setupPassword,
  changePassword,
  listSessions,
  revokeSessions,
};

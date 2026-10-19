const authService = require("../services/auth.service");
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

module.exports = { login, signup, refresh, logout, me };

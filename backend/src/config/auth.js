require("./env");

const DAY_MS = 24 * 60 * 60 * 1000;

// Auth settings, read on every call so tests can change process.env.
//   JWT_ACCESS_SECRET  signs access tokens (required)
//   JWT_ACCESS_TTL     access token lifetime, jsonwebtoken format (default "15m", D12)
//   REFRESH_TTL_DAYS   refresh cookie/session lifetime in days, renewed on every rotation (default 7, D13)
const getAuthConfig = () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret) throw new Error("JWT_ACCESS_SECRET is not set");
  const refreshTtlDays = Number(process.env.REFRESH_TTL_DAYS) || 7;
  return {
    accessSecret,
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtlMs: refreshTtlDays * DAY_MS,
  };
};

// The refresh cookie. The API is mounted under /api, so the auth paths are /api/auth/*.
const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

const refreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: REFRESH_COOKIE_PATH,
});

// CORS_ORIGIN: the UI origin allowed to call the API with credentials.
const getCorsOrigin = () => process.env.CORS_ORIGIN || "http://localhost:5173";

module.exports = { getAuthConfig, REFRESH_COOKIE, refreshCookieOptions, getCorsOrigin };

require("./env");

// Per-IP rate limits for the public auth routes (D11), read on every call so tests can change process.env.
//   RATE_LIMIT_WINDOW_MS    window length in ms (default 60000 = one minute)
//   RATE_LIMIT_AUTH_MAX     requests per window on login, signup, forgot-password, verify-otp,
//                           reset-password and setup-password, per route (default 10)
//   RATE_LIMIT_REFRESH_MAX  requests per window on refresh (default 60)
//   RATE_LIMIT_LOOKUP_MAX   requests per window on the public country/city lookups, per route (default 60)
// Under NODE_ENV=test the defaults are generous so the suite (one IP) isn't throttled;
// the rate-limit tests pass explicit limits to createAuthRouter().
const TEST_DEFAULT_MAX = 10000;

const getRateLimitConfig = () => {
  const isTest = process.env.NODE_ENV === "test";
  return {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX) || (isTest ? TEST_DEFAULT_MAX : 10),
    refreshMax: Number(process.env.RATE_LIMIT_REFRESH_MAX) || (isTest ? TEST_DEFAULT_MAX : 60),
    lookupMax: Number(process.env.RATE_LIMIT_LOOKUP_MAX) || (isTest ? TEST_DEFAULT_MAX : 60),
  };
};

module.exports = { getRateLimitConfig };

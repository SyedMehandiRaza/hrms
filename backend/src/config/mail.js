require("./env");

// Mail settings, read on every call so tests can switch drivers via process.env.
// MAIL_DRIVER: console (dev default) | memory (default when NODE_ENV=test) | smtp (not built yet).
const getMailConfig = () => ({
  driver: process.env.MAIL_DRIVER || (process.env.NODE_ENV === "test" ? "memory" : "console"),
  from: process.env.MAIL_FROM || "no-reply@hrms.test",
  appUrl: (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, ""),
});

module.exports = { getMailConfig };

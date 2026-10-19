require("./env");

// Mail settings, read on every call so tests can switch drivers via process.env.
// MAIL_DRIVER: console (dev default) | memory (default when NODE_ENV=test) | smtp.
// SMTP_*: used only by the smtp driver; auth is sent only when SMTP_USER is set.
const getMailConfig = () => ({
  driver: process.env.MAIL_DRIVER || (process.env.NODE_ENV === "test" ? "memory" : "console"),
  from: process.env.MAIL_FROM || "no-reply@hrms.test",
  appUrl: (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, ""),
  smtp: {
    host: process.env.SMTP_HOST || undefined,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true",
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
  },
});

module.exports = { getMailConfig };

const { getMailConfig } = require("../../config/mail");
const templates = require("./templates");
const drivers = {
  console: require("./drivers/console"),
  memory: require("./drivers/memory"),
  smtp: require("./drivers/smtp"),
};

// users.lang_key is "EN" | "AR"; anything else falls back to English.
const resolveLang = (lang) => (String(lang || "").toLowerCase() === "ar" ? "ar" : "en");

// Renders a template in the person's language and hands it to the MAIL_DRIVER driver.
// Programmer errors (unknown template/driver, missing data or recipient) reject loudly.
// Usage: await mailer.send({ to, lang: user.lang_key, template: "reset-otp", data: { code } })
const send = async ({ to, lang, template, data = {} } = {}) => {
  const config = getMailConfig();
  const driver = drivers[config.driver];
  if (!driver) throw new Error(`Unknown MAIL_DRIVER "${config.driver}"`);
  if (!to) throw new Error("Mail recipient is required");

  const tpl = templates[template];
  if (!tpl) throw new Error(`Unknown mail template "${template}"`);
  const missing = tpl.required.filter((key) => data[key] === undefined || data[key] === null || data[key] === "");
  if (missing.length) throw new Error(`Mail template "${template}" is missing data: ${missing.join(", ")}`);

  const language = resolveLang(lang);
  const { subject, text, html } = tpl[language](data, { appUrl: config.appUrl });
  const mail = { to, from: config.from, lang: language, template, subject, text, ...(html ? { html } : {}) };

  await driver.deliver(mail);
  return mail;
};

module.exports = {
  send,
  outbox: drivers.memory.outbox,
  clear: drivers.memory.clear,
};

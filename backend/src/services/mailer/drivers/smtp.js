const nodemailer = require("nodemailer");
const { getMailConfig } = require("../../../config/mail");

// SMTP driver (nodemailer). The transport is built on the first send, so a missing or
// wrong setting never stops the server from starting, and rebuilt if the settings change.
// Logs only the template, recipient and message id — never the body (it may hold a
// temporary password or code) or the SMTP credentials.
let cached = null; // { key, transport }

const transportOptions = ({ host, port, secure, user, pass }) => ({
  host,
  port,
  secure,
  ...(user ? { auth: { user, pass } } : {}),
});

const getTransport = (smtp) => {
  const options = transportOptions(smtp);
  const key = JSON.stringify(options);
  if (!cached || cached.key !== key) cached = { key, transport: nodemailer.createTransport(options) };
  return cached.transport;
};

// Removes the SMTP credentials from a transport error message.
const scrub = (message, { user, pass }) => {
  let safe = String(message || "SMTP send failed");
  for (const secret of [pass, user]) {
    if (secret) safe = safe.split(secret).join("***");
  }
  return safe;
};

const deliver = async (mail) => {
  const { smtp } = getMailConfig();
  if (!smtp.host) throw new Error("SMTP mail driver is not configured");

  const message = {
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    ...(mail.html ? { html: mail.html } : {}),
  };

  try {
    const info = await getTransport(smtp).sendMail(message);
    console.log("[mailer] smtp sent", { template: mail.template, to: mail.to, messageId: info && info.messageId });
  } catch (err) {
    const safe = scrub(err && err.message, smtp);
    console.error("[mailer] smtp send failed", { template: mail.template, to: mail.to, error: safe });
    // No `cause` on purpose: the original error may carry the SMTP credentials.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(safe);
  }
};

// Drops the cached transport (tests).
const reset = () => {
  cached = null;
};

module.exports = { deliver, reset };

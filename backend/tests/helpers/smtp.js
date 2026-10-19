const nodemailer = require("nodemailer");
const smtpDriver = require("../../src/services/mailer/drivers/smtp");

// Switches the mailer to the SMTP driver with a stubbed transport whose every send fails.
// The calling test file must `jest.mock("nodemailer")`. Returns { sendMail, restore }.
const ENV_KEYS = ["MAIL_DRIVER", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];
const SMTP_PASS = "smtp-test-secret";

const useFailingSmtp = (error = new Error("connect ECONNREFUSED 127.0.0.1:2525")) => {
  const saved = {};
  ENV_KEYS.forEach((key) => (saved[key] = process.env[key]));
  Object.assign(process.env, {
    MAIL_DRIVER: "smtp",
    SMTP_HOST: "smtp.hrms.test",
    SMTP_PORT: "2525",
    SMTP_USER: "mailer@hrms.test",
    SMTP_PASS,
  });
  delete process.env.SMTP_SECURE;
  smtpDriver.reset();

  const sendMail = jest.fn().mockRejectedValue(error);
  nodemailer.createTransport.mockReset();
  nodemailer.createTransport.mockImplementation(() => ({ sendMail }));

  const restore = () => {
    ENV_KEYS.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
    smtpDriver.reset();
  };
  return { sendMail, restore };
};

// Waits (a few event-loop turns) until the spy has been called; for fire-and-forget sends.
const waitForCall = async (spy, tries = 50) => {
  for (let i = 0; i < tries && spy.mock.calls.length === 0; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

module.exports = { useFailingSmtp, waitForCall, SMTP_PASS };

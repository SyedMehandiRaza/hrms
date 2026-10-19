jest.mock("nodemailer");

const nodemailer = require("nodemailer");
const mailer = require("../src/services/mailer");
const smtpDriver = require("../src/services/mailer/drivers/smtp");
const { getMailConfig } = require("../src/config/mail");

// Each test sets the mail env vars it needs; restore the originals afterwards.
const SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];
const ENV_KEYS = ["MAIL_DRIVER", "MAIL_FROM", "APP_URL", "NODE_ENV", ...SMTP_KEYS];
const saved = {};
beforeAll(() => ENV_KEYS.forEach((key) => (saved[key] = process.env[key])));
afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  });
  mailer.clear();
  jest.restoreAllMocks();
});

const clearSmtpEnv = () => SMTP_KEYS.forEach((key) => delete process.env[key]);

const useMemory = () => {
  clearSmtpEnv();
  process.env.MAIL_DRIVER = "memory";
  process.env.MAIL_FROM = "no-reply@hrms.test";
  process.env.APP_URL = "http://app.test";
};

describe("mail config", () => {
  test("defaults: console driver, no-reply sender, local app URL", () => {
    delete process.env.MAIL_DRIVER;
    delete process.env.MAIL_FROM;
    delete process.env.APP_URL;
    clearSmtpEnv();
    process.env.NODE_ENV = "development";
    expect(getMailConfig()).toEqual({
      driver: "console",
      from: "no-reply@hrms.test",
      appUrl: "http://localhost:5173",
      smtp: { host: undefined, port: 587, secure: false, user: undefined, pass: undefined },
    });
  });

  test("defaults to the memory driver when NODE_ENV=test and MAIL_DRIVER is unset", () => {
    delete process.env.MAIL_DRIVER;
    process.env.NODE_ENV = "test";
    expect(getMailConfig().driver).toBe("memory");
  });

  test("reads MAIL_DRIVER, MAIL_FROM and APP_URL (trailing slash removed)", () => {
    process.env.MAIL_DRIVER = "console";
    process.env.MAIL_FROM = "hr@example.com";
    process.env.APP_URL = "https://hrms.example.com/";
    process.env.NODE_ENV = "test";
    clearSmtpEnv();
    expect(getMailConfig()).toEqual({
      driver: "console",
      from: "hr@example.com",
      appUrl: "https://hrms.example.com",
      smtp: { host: undefined, port: 587, secure: false, user: undefined, pass: undefined },
    });
  });

  test("reads the SMTP settings: host, port, secure flag, user and password", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASS = "s3cret-pass";
    expect(getMailConfig().smtp).toEqual({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "mailer@example.com",
      pass: "s3cret-pass",
    });
  });

  test('SMTP port defaults to 587 and secure is true only for "true"', () => {
    clearSmtpEnv();
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_SECURE = "yes";
    expect(getMailConfig().smtp).toMatchObject({ port: 587, secure: false });
    process.env.SMTP_SECURE = "TRUE";
    expect(getMailConfig().smtp.secure).toBe(true);
    process.env.SMTP_SECURE = "false";
    expect(getMailConfig().smtp.secure).toBe(false);
  });
});

describe("welcome-temp-password", () => {
  const data = { email: "new.person@acme.test", temporaryPassword: "Tmp#Pass9", setupToken: "tok123" };

  test("EN: lands in the outbox once with email, temporary password, setup link and 72 hours", async () => {
    useMemory();
    await mailer.send({ to: "new.person@acme.test", lang: "en", template: "welcome-temp-password", data });

    const outbox = mailer.outbox();
    expect(outbox).toHaveLength(1);
    const [mail] = outbox;
    expect(mail).toMatchObject({
      to: "new.person@acme.test",
      from: "no-reply@hrms.test",
      lang: "en",
      template: "welcome-temp-password",
      subject: "Your login details",
    });
    expect(mail.text).toContain("Email: new.person@acme.test");
    expect(mail.text).toContain("Temporary password: Tmp#Pass9");
    expect(mail.text).toContain("Set your password: http://app.test/reset-password?setup=tok123");
    expect(mail.text).toContain("72 hours");
  });

  test("AR: Arabic subject and body with the same values and link", async () => {
    useMemory();
    await mailer.send({ to: "new.person@acme.test", lang: "AR", template: "welcome-temp-password", data });

    const [mail] = mailer.outbox();
    expect(mail.lang).toBe("ar");
    expect(mail.subject).toBe("بيانات تسجيل الدخول الخاصة بك");
    expect(mail.text).toContain("new.person@acme.test");
    expect(mail.text).toContain("Tmp#Pass9");
    expect(mail.text).toContain("http://app.test/reset-password?setup=tok123");
    expect(mail.text).toContain("72 ساعة");
  });

  test("the setup token is URL-encoded in the link", async () => {
    useMemory();
    await mailer.send({
      to: "a@b.test",
      template: "welcome-temp-password",
      data: { ...data, setupToken: "a b/c+d" },
    });
    expect(mailer.outbox()[0].text).toContain("/reset-password?setup=a%20b%2Fc%2Bd");
  });
});

describe("welcome-existing-password", () => {
  test("EN: tells the person to use their existing password and points to Forgot Password?", async () => {
    useMemory();
    await mailer.send({
      to: "known@acme.test",
      lang: "en",
      template: "welcome-existing-password",
      data: { email: "known@acme.test" },
    });

    const outbox = mailer.outbox();
    expect(outbox).toHaveLength(1);
    const [mail] = outbox;
    expect(mail).toMatchObject({ to: "known@acme.test", lang: "en", subject: "Your login is ready" });
    expect(mail.text).toContain("known@acme.test");
    expect(mail.text).toContain("existing password");
    expect(mail.text).toContain('"Forgot Password?"');
    expect(mail.text).toContain("http://app.test/login");
    expect(mail.text).not.toMatch(/temporary password/i);
  });

  test("AR: Arabic subject and body pointing to نسيت كلمة المرور؟", async () => {
    useMemory();
    await mailer.send({
      to: "known@acme.test",
      lang: "ar",
      template: "welcome-existing-password",
      data: { email: "known@acme.test" },
    });

    const [mail] = mailer.outbox();
    expect(mail.lang).toBe("ar");
    expect(mail.subject).toBe("حساب الدخول الخاص بك جاهز");
    expect(mail.text).toContain("كلمة المرور الحالية");
    expect(mail.text).toContain("نسيت كلمة المرور؟");
    expect(mail.text).toContain("http://app.test/login");
  });
});

describe("reset-otp", () => {
  test("EN: contains the 6-digit code and says it expires in 10 minutes", async () => {
    useMemory();
    await mailer.send({ to: "user@acme.test", lang: "en", template: "reset-otp", data: { code: "482913" } });

    const outbox = mailer.outbox();
    expect(outbox).toHaveLength(1);
    const [mail] = outbox;
    expect(mail).toMatchObject({ to: "user@acme.test", lang: "en", subject: "Your password reset code" });
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("10 minutes");
  });

  test("AR: Arabic subject, the code and 10 minutes", async () => {
    useMemory();
    await mailer.send({ to: "user@acme.test", lang: "ar", template: "reset-otp", data: { code: "482913" } });

    const [mail] = mailer.outbox();
    expect(mail.lang).toBe("ar");
    expect(mail.subject).toBe("رمز إعادة تعيين كلمة المرور");
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("10 دقائق");
  });
});

describe("send()", () => {
  test("unknown or missing language falls back to English", async () => {
    useMemory();
    await mailer.send({ to: "x@acme.test", template: "reset-otp", data: { code: "111111" } });
    await mailer.send({ to: "x@acme.test", lang: "fr", template: "reset-otp", data: { code: "222222" } });
    expect(mailer.outbox().map((m) => m.lang)).toEqual(["en", "en"]);
  });

  test("returns the sent message", async () => {
    useMemory();
    const mail = await mailer.send({ to: "x@acme.test", template: "reset-otp", data: { code: "123456" } });
    expect(mail).toEqual(mailer.outbox()[0]);
  });

  test("outbox() returns a copy and clear() empties it", async () => {
    useMemory();
    await mailer.send({ to: "x@acme.test", template: "reset-otp", data: { code: "123456" } });
    mailer.outbox().pop();
    expect(mailer.outbox()).toHaveLength(1);
    mailer.clear();
    expect(mailer.outbox()).toEqual([]);
  });

  test("an unknown template fails loudly and sends nothing", async () => {
    useMemory();
    await expect(mailer.send({ to: "x@acme.test", template: "nope", data: {} })).rejects.toThrow(
      'Unknown mail template "nope"',
    );
    expect(mailer.outbox()).toEqual([]);
  });

  test("missing template data fails loudly and sends nothing", async () => {
    useMemory();
    await expect(mailer.send({ to: "x@acme.test", template: "reset-otp", data: {} })).rejects.toThrow(
      'Mail template "reset-otp" is missing data: code',
    );
    expect(mailer.outbox()).toEqual([]);
  });

  test("a missing recipient fails loudly", async () => {
    useMemory();
    await expect(mailer.send({ template: "reset-otp", data: { code: "123456" } })).rejects.toThrow(
      "Mail recipient is required",
    );
  });

  test("an unknown driver fails loudly", async () => {
    useMemory();
    process.env.MAIL_DRIVER = "carrier-pigeon";
    await expect(mailer.send({ to: "x@acme.test", template: "reset-otp", data: { code: "1" } })).rejects.toThrow(
      'Unknown MAIL_DRIVER "carrier-pigeon"',
    );
  });

  test("the smtp driver without SMTP_HOST reports it is not configured", async () => {
    useMemory();
    process.env.MAIL_DRIVER = "smtp";
    await expect(mailer.send({ to: "x@acme.test", template: "reset-otp", data: { code: "1" } })).rejects.toThrow(
      "SMTP mail driver is not configured",
    );
  });
});

describe("console driver", () => {
  test("prints recipient, subject and body and does not use the outbox", async () => {
    useMemory();
    process.env.MAIL_DRIVER = "console";
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    const mail = await mailer.send({ to: "dev@acme.test", template: "reset-otp", data: { code: "654321" } });

    const printed = log.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(printed).toContain("To: dev@acme.test");
    expect(printed).toContain("Subject: Your password reset code");
    expect(printed).toContain("654321");
    expect(mail.subject).toBe("Your password reset code");
    expect(mailer.outbox()).toEqual([]);
  });

  test("never crashes the request when printing fails", async () => {
    useMemory();
    process.env.MAIL_DRIVER = "console";
    jest.spyOn(console, "log").mockImplementation(() => {
      throw new Error("stdout closed");
    });
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      mailer.send({ to: "dev@acme.test", template: "reset-otp", data: { code: "654321" } }),
    ).resolves.toMatchObject({ to: "dev@acme.test" });
    expect(error).toHaveBeenCalled();
  });
});

describe("smtp driver", () => {
  const SMTP_PASS = "Sup3r-Secret!pass";
  let sendMail;

  const useSmtp = (overrides = {}) => {
    useMemory();
    process.env.MAIL_DRIVER = "smtp";
    process.env.MAIL_FROM = "HRMS <no-reply@hrms.example.com>";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_USER = "mailer@hrms.example.com";
    process.env.SMTP_PASS = SMTP_PASS;
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  };

  const printed = (spy) => spy.mock.calls.map((args) => JSON.stringify(args)).join("\n");

  beforeEach(() => {
    smtpDriver.reset();
    sendMail = jest.fn().mockResolvedValue({ messageId: "<msg-1@hrms.example.com>" });
    nodemailer.createTransport.mockReset();
    nodemailer.createTransport.mockImplementation(() => ({ sendMail }));
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  test("creates no transport until the first send", () => {
    useSmtp();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test("builds the transport from the SMTP settings, once, and reuses it", async () => {
    useSmtp({ SMTP_SECURE: "true" });
    await mailer.send({ to: "a@acme.test", template: "reset-otp", data: { code: "111111" } });
    await mailer.send({ to: "b@acme.test", template: "reset-otp", data: { code: "222222" } });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 2525,
      secure: true,
      auth: { user: "mailer@hrms.example.com", pass: SMTP_PASS },
    });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  test("defaults to port 587, not secure, and sends no auth when SMTP_USER is unset", async () => {
    useSmtp({ SMTP_PORT: undefined, SMTP_SECURE: undefined, SMTP_USER: undefined, SMTP_PASS: undefined });
    await mailer.send({ to: "a@acme.test", template: "reset-otp", data: { code: "111111" } });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({ host: "smtp.example.com", port: 587, secure: false });
  });

  test("a missing SMTP_HOST rejects with a clear error and creates no transport", async () => {
    useSmtp({ SMTP_HOST: undefined });
    await expect(mailer.send({ to: "a@acme.test", template: "reset-otp", data: { code: "1" } })).rejects.toThrow(
      "SMTP mail driver is not configured",
    );
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test.each([
    ["en", "reset-otp", { code: "482913" }, "Your password reset code", ["482913", "10 minutes"]],
    ["ar", "reset-otp", { code: "482913" }, "رمز إعادة تعيين كلمة المرور", ["482913", "10 دقائق"]],
    [
      "en",
      "welcome-temp-password",
      { email: "new@acme.test", temporaryPassword: "Tmp#Pass9xyz", setupToken: "tok123" },
      "Your login details",
      ["Temporary password: Tmp#Pass9xyz", "http://app.test/reset-password?setup=tok123"],
    ],
    [
      "ar",
      "welcome-temp-password",
      { email: "new@acme.test", temporaryPassword: "Tmp#Pass9xyz", setupToken: "tok123" },
      "بيانات تسجيل الدخول الخاصة بك",
      ["Tmp#Pass9xyz", "72 ساعة"],
    ],
    ["en", "welcome-existing-password", { email: "known@acme.test" }, "Your login is ready", ["existing password"]],
    ["ar", "welcome-existing-password", { email: "known@acme.test" }, "حساب الدخول الخاص بك جاهز", ["نسيت كلمة المرور؟"]],
  ])("%s %s: hands one message with sender, recipient, subject and body to the transport", async (lang, template, data, subject, bodyParts) => {
    useSmtp();
    process.env.APP_URL = "http://app.test";
    await mailer.send({ to: "person@acme.test", lang, template, data });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const [message] = sendMail.mock.calls[0];
    expect(Object.keys(message).sort()).toEqual(["from", "subject", "text", "to"]);
    expect(message).toMatchObject({ from: "HRMS <no-reply@hrms.example.com>", to: "person@acme.test", subject });
    bodyParts.forEach((part) => expect(message.text).toContain(part));
    expect(mailer.outbox()).toEqual([]);
  });

  test("passes html along when a template provides it", async () => {
    useSmtp();
    await smtpDriver.deliver({
      to: "a@acme.test",
      from: "HRMS <no-reply@hrms.example.com>",
      template: "reset-otp",
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "HRMS <no-reply@hrms.example.com>",
      to: "a@acme.test",
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });
  });

  test("logs template, recipient and message id on success, never the body or credentials", async () => {
    useSmtp();
    await mailer.send({
      to: "new@acme.test",
      template: "welcome-temp-password",
      data: { email: "new@acme.test", temporaryPassword: "Tmp#Pass9xyz", setupToken: "tok123" },
    });

    const logs = printed(console.log);
    expect(logs).toContain("welcome-temp-password");
    expect(logs).toContain("new@acme.test");
    expect(logs).toContain("<msg-1@hrms.example.com>");
    expect(logs).not.toContain("Tmp#Pass9xyz");
    expect(logs).not.toContain("tok123");
    expect(logs).not.toContain(SMTP_PASS);
  });

  test("a failed send rejects and logs the error without the password, credentials or body", async () => {
    useSmtp();
    sendMail.mockRejectedValue(new Error(`Invalid login: 535 auth failed for mailer@hrms.example.com/${SMTP_PASS}`));

    let caught;
    try {
      await mailer.send({
        to: "new@acme.test",
        template: "welcome-temp-password",
        data: { email: "new@acme.test", temporaryPassword: "Tmp#Pass9xyz", setupToken: "tok123" },
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toContain("Invalid login: 535");
    expect(caught.message).not.toContain(SMTP_PASS);

    const errors = printed(console.error);
    expect(errors).toContain("welcome-temp-password");
    expect(errors).toContain("new@acme.test");
    expect(errors).toContain("Invalid login: 535");
    expect(errors).not.toContain(SMTP_PASS);
    expect(errors).not.toContain("Tmp#Pass9xyz");
    expect(printed(console.log)).not.toContain(SMTP_PASS);
  });

  test("a new transport is built when the SMTP settings change", async () => {
    useSmtp();
    await mailer.send({ to: "a@acme.test", template: "reset-otp", data: { code: "111111" } });
    process.env.SMTP_HOST = "smtp.other.example.com";
    await mailer.send({ to: "a@acme.test", template: "reset-otp", data: { code: "111111" } });
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    expect(nodemailer.createTransport.mock.calls[1][0]).toMatchObject({ host: "smtp.other.example.com" });
  });

  test("the console and memory drivers never touch the SMTP transport", async () => {
    useSmtp();
    process.env.MAIL_DRIVER = "memory";
    await mailer.send({ to: "a@acme.test", template: "reset-otp", data: { code: "111111" } });
    process.env.MAIL_DRIVER = "console";
    await mailer.send({ to: "a@acme.test", template: "reset-otp", data: { code: "111111" } });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mailer.outbox()).toHaveLength(1);
  });
});

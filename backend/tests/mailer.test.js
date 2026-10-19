const mailer = require("../src/services/mailer");
const { getMailConfig } = require("../src/config/mail");

// Each test sets the mail env vars it needs; restore the originals afterwards.
const ENV_KEYS = ["MAIL_DRIVER", "MAIL_FROM", "APP_URL", "NODE_ENV"];
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

const useMemory = () => {
  process.env.MAIL_DRIVER = "memory";
  process.env.MAIL_FROM = "no-reply@hrms.test";
  process.env.APP_URL = "http://app.test";
};

describe("mail config", () => {
  test("defaults: console driver, no-reply sender, local app URL", () => {
    delete process.env.MAIL_DRIVER;
    delete process.env.MAIL_FROM;
    delete process.env.APP_URL;
    process.env.NODE_ENV = "development";
    expect(getMailConfig()).toEqual({
      driver: "console",
      from: "no-reply@hrms.test",
      appUrl: "http://localhost:5173",
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
    expect(getMailConfig()).toEqual({
      driver: "console",
      from: "hr@example.com",
      appUrl: "https://hrms.example.com",
    });
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

  test("the smtp driver is a stub that reports it is not configured", async () => {
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

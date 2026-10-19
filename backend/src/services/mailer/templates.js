// Email templates: one entry per template with the data keys it needs and a renderer per language.
// Each renderer is (data, { appUrl }) => { subject, text } (an optional `html` may be added later).
// Durations follow the plan: setup link + temporary password 72 h (ADR 3), reset code 10 min (ADR 1).

const setupLink = (appUrl, token) => `${appUrl}/reset-password?setup=${encodeURIComponent(token)}`;
const loginLink = (appUrl) => `${appUrl}/login`;

module.exports = {
  "welcome-temp-password": {
    required: ["email", "temporaryPassword", "setupToken"],
    en: ({ email, temporaryPassword, setupToken }, { appUrl }) => ({
      subject: "Your login details",
      text: [
        "Hello,",
        "",
        "A login has been created for you.",
        "",
        `Email: ${email}`,
        `Temporary password: ${temporaryPassword}`,
        "",
        `Set your password: ${setupLink(appUrl, setupToken)}`,
        "",
        "The temporary password and the link expire in 72 hours.",
        "If you log in with the temporary password, you will be asked to change it.",
      ].join("\n"),
    }),
    // AR: needs native review
    ar: ({ email, temporaryPassword, setupToken }, { appUrl }) => ({
      subject: "بيانات تسجيل الدخول الخاصة بك",
      text: [
        "مرحبًا،",
        "",
        "تم إنشاء حساب دخول لك.",
        "",
        `البريد الإلكتروني: ${email}`,
        `كلمة المرور المؤقتة: ${temporaryPassword}`,
        "",
        `تعيين كلمة المرور: ${setupLink(appUrl, setupToken)}`,
        "",
        "تنتهي صلاحية كلمة المرور المؤقتة والرابط خلال 72 ساعة.",
        "إذا سجلت الدخول بكلمة المرور المؤقتة، فسيُطلب منك تغييرها.",
      ].join("\n"),
    }),
  },

  "welcome-existing-password": {
    required: ["email"],
    en: ({ email }, { appUrl }) => ({
      subject: "Your login is ready",
      text: [
        "Hello,",
        "",
        "A login has been created for you.",
        "",
        `Log in with your email (${email}) and your existing password: ${loginLink(appUrl)}`,
        "",
        'If you don\'t remember your password, use "Forgot Password?" on the login page.',
      ].join("\n"),
    }),
    // AR: needs native review
    ar: ({ email }, { appUrl }) => ({
      subject: "حساب الدخول الخاص بك جاهز",
      text: [
        "مرحبًا،",
        "",
        "تم إنشاء حساب دخول لك.",
        "",
        `سجّل الدخول باستخدام بريدك الإلكتروني (${email}) وكلمة المرور الحالية: ${loginLink(appUrl)}`,
        "",
        "إذا كنت لا تتذكر كلمة المرور، فاستخدم \"نسيت كلمة المرور؟\" في صفحة تسجيل الدخول.",
      ].join("\n"),
    }),
  },

  "reset-otp": {
    required: ["code"],
    en: ({ code }) => ({
      subject: "Your password reset code",
      text: [
        "Hello,",
        "",
        `Your password reset code is: ${code}`,
        "",
        "This code expires in 10 minutes.",
        "If you didn't ask to reset your password, you can ignore this email.",
      ].join("\n"),
    }),
    // AR: needs native review
    ar: ({ code }) => ({
      subject: "رمز إعادة تعيين كلمة المرور",
      text: [
        "مرحبًا،",
        "",
        `رمز إعادة تعيين كلمة المرور الخاص بك هو: ${code}`,
        "",
        "تنتهي صلاحية هذا الرمز خلال 10 دقائق.",
        "إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.",
      ].join("\n"),
    }),
  },
};

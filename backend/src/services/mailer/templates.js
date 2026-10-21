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

  // Exit approvals (workforce D68; wording approved by the user 2026-10-21): the current level's
  // approvers, then the raiser and the leaving employee.
  "exit-approval-needed": {
    required: ["employeeName"],
    en: ({ employeeName }) => ({
      subject: "Exit request needs your approval",
      text: `An exit request for ${employeeName} needs your approval.`,
    }),
    // AR: needs native review
    ar: ({ employeeName }) => ({
      subject: "طلب إنهاء خدمة بانتظار موافقتك",
      text: `طلب إنهاء خدمة للموظف ${employeeName} بانتظار موافقتك.`,
    }),
  },

  "exit-approved": {
    required: ["employeeName", "lastWorkingDay"],
    en: ({ employeeName, lastWorkingDay }) => ({
      subject: "Exit request approved",
      text: `The exit request for ${employeeName} has been approved. Last working day: ${lastWorkingDay}.`,
    }),
    // AR: needs native review
    ar: ({ employeeName, lastWorkingDay }) => ({
      subject: "تمت الموافقة على طلب إنهاء الخدمة",
      text: `تمت الموافقة على طلب إنهاء الخدمة للموظف ${employeeName}. آخر يوم عمل: ${lastWorkingDay}.`,
    }),
  },

  "exit-rejected": {
    required: ["employeeName", "reason"],
    en: ({ employeeName, reason }) => ({
      subject: "Exit request rejected",
      text: `The exit request for ${employeeName} has been rejected. Reason: ${reason}`,
    }),
    // AR: needs native review
    ar: ({ employeeName, reason }) => ({
      subject: "تم رفض طلب إنهاء الخدمة",
      text: `تم رفض طلب إنهاء الخدمة للموظف ${employeeName}. السبب: ${reason}`,
    }),
  },

  "exit-approved-employee": {
    required: ["lastWorkingDay"],
    en: ({ lastWorkingDay }) => ({
      subject: "Your employment is ending",
      text: `Your exit has been approved. Your last working day is ${lastWorkingDay}.`,
    }),
    // AR: needs native review
    ar: ({ lastWorkingDay }) => ({
      subject: "خدمتك على وشك الانتهاء",
      text: `تمت الموافقة على إنهاء خدمتك. آخر يوم عمل لك هو ${lastWorkingDay}.`,
    }),
  },
};

// Contract notification texts (plan decision 43). EN is exact from the plan; AR drafts are
// marked for native review. {{placeholders}}: name, number, signBy, recipient, reason.
// The email subject is the title; the email body is the body plus an "Open contract" link.

const NOTIFICATIONS = Object.freeze({
  CONTRACT_SENT: {
    en: { title: "New contract to sign", body: "{{name}} ({{number}}) is waiting for your signature. Sign by {{signBy}}." },
    ar: { title: "عقد جديد للتوقيع", body: "العقد {{name}} ({{number}}) بانتظار توقيعك. وقّع قبل {{signBy}}." }, // AR: needs native review
  },
  CONTRACT_SIGNED: {
    en: { title: "Contract signed", body: "{{recipient}} signed {{name}} ({{number}}). It's ready for your approval." },
    ar: { title: "تم توقيع العقد", body: "وقّع {{recipient}} العقد {{name}} ({{number}}). العقد جاهز لاعتمادك." }, // AR: needs native review
  },
  CONTRACT_REJECTED: {
    en: { title: "Contract rejected", body: "{{recipient}} rejected {{name}} ({{number}}): {{reason}}" },
    ar: { title: "تم رفض العقد", body: "رفض {{recipient}} العقد {{name}} ({{number}}): {{reason}}" }, // AR: needs native review
  },
  CONTRACT_EXPIRING: {
    en: { title: "Contract expires soon", body: "{{name}} ({{number}}) must be signed by {{signBy}}." },
    ar: { title: "العقد على وشك الانتهاء", body: "يجب توقيع العقد {{name}} ({{number}}) قبل {{signBy}}." }, // AR: needs native review
  },
  CONTRACT_EXPIRED: {
    en: { title: "Contract expired", body: "{{name}} ({{number}}) wasn't signed by {{signBy}} and has expired." },
    ar: { title: "انتهت صلاحية العقد", body: "لم يتم توقيع العقد {{name}} ({{number}}) قبل {{signBy}} وانتهت صلاحيته." }, // AR: needs native review
  },
  CONTRACT_REVOKED: {
    en: { title: "Contract withdrawn", body: "{{name}} ({{number}}) was withdrawn by HR: {{reason}}" },
    ar: { title: "تم سحب العقد", body: "سحبت الموارد البشرية العقد {{name}} ({{number}}): {{reason}}" }, // AR: needs native review
  },
  CONTRACT_REVOKED_AUTO: {
    en: { title: "Contract withdrawn", body: "{{name}} ({{number}}) was withdrawn because {{recipient}} is no longer active." },
    ar: { title: "تم سحب العقد", body: "تم سحب العقد {{name}} ({{number}}) لأن {{recipient}} لم يعد نشطًا." }, // AR: needs native review
  },
  CONTRACT_COMPLETED: {
    en: { title: "Contract completed", body: "{{name}} ({{number}}) has been approved. You can download the final PDF." },
    ar: { title: "اكتمل العقد", body: "تم اعتماد العقد {{name}} ({{number}}). يمكنك تنزيل ملف PDF النهائي." }, // AR: needs native review
  },
});

const OPEN_CONTRACT = Object.freeze({ en: "Open contract", ar: "فتح العقد" }); // AR: needs native review

module.exports = { NOTIFICATIONS, OPEN_CONTRACT };

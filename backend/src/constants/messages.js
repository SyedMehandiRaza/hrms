// Message catalog (docs/standards.md §7, ADR 0004). tests/messages.test.js
// checks it against the standards doc word for word.
//
// English is copied exactly from standards §7. Arabic is reused from
// hrms/src/locales/ar wherever the UI has the same English text; lines marked
// "AR: needs native review" are drafts.

// code → { status, en, ar }. Use with `new ErrorHandler(code)`.
const MESSAGES = Object.freeze({
  VALIDATION_FAILED: {
    status: 400,
    en: "Please fix the highlighted fields.",
    ar: "يرجى تصحيح الحقول المحددة.", // AR: needs native review
  },
  INVALID_JSON: {
    status: 400,
    en: "Malformed JSON body",
    ar: "صيغة JSON في نص الطلب غير صالحة", // AR: needs native review
  },
  AUTH_REQUIRED: {
    status: 401,
    en: "Please log in to continue.",
    ar: "يرجى تسجيل الدخول للمتابعة.", // AR: needs native review
  },
  AUTH_TOKEN_EXPIRED: {
    status: 401,
    en: "Your session has expired. Please log in again.",
    ar: "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.", // AR: needs native review
  },
  AUTH_REFRESH_INVALID: {
    status: 401,
    en: "Your session has expired. Please log in again.",
    ar: "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.", // AR: needs native review
  },
  FORBIDDEN: {
    status: 403,
    en: "You don't have permission to do this.",
    ar: "ليست لديك صلاحية للقيام بهذا الإجراء.", // AR: needs native review
  },
  NOT_FOUND: {
    status: 404,
    en: "The requested record was not found.",
    ar: "لم يتم العثور على السجل المطلوب.", // AR: needs native review
  },
  RATE_LIMITED: {
    status: 429,
    en: "Too many requests. Please try again in a minute.",
    ar: "طلبات كثيرة جدًا. يرجى المحاولة مرة أخرى بعد دقيقة.", // AR: needs native review
  },
  INTERNAL_ERROR: {
    status: 500,
    en: "Something went wrong. Please try again.",
    ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  },
  AUTH_INVALID_CREDENTIALS: {
    status: 401,
    en: "Invalid email or password.",
    ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.", // AR: needs native review
  },
  AUTH_ACCOUNT_LOCKED: {
    status: 423,
    en: "Too many failed attempts. Try again in 15 minutes.",
    ar: "محاولات فاشلة كثيرة جدًا. حاول مرة أخرى بعد 15 دقيقة.", // AR: needs native review
  },
  AUTH_ACCOUNT_INACTIVE: {
    status: 403,
    en: "Your account is inactive. Contact your administrator.",
    ar: "حسابك غير نشط. تواصل مع المسؤول.", // AR: needs native review
  },
  AUTH_COMPANY_INACTIVE: {
    status: 403,
    en: "Your company's access is disabled. Contact support.",
    ar: "تم تعطيل وصول شركتك. تواصل مع الدعم.", // AR: needs native review
  },
  AUTH_SETUP_EXPIRED: {
    status: 403,
    en: "Your temporary password has expired. Ask your administrator to resend it.",
    ar: "انتهت صلاحية كلمة المرور المؤقتة. اطلب من المسؤول إعادة إرسالها.", // AR: needs native review
  },
  AUTH_PASSWORD_CHANGE_REQUIRED: {
    status: 403,
    en: "Please change your temporary password to continue.",
    ar: "يرجى تغيير كلمة المرور المؤقتة للمتابعة.", // AR: needs native review
  },
  AUTH_RESET_SENT: {
    status: 200,
    en: "If an account exists for this email, you'll receive a reset code.",
    ar: "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فستتلقى رمز إعادة التعيين.", // AR: needs native review
  },
  AUTH_OTP_INVALID: {
    status: 400,
    en: "This code is incorrect or has expired. Please try again.",
    ar: "هذا الرمز غير صحيح أو منتهي الصلاحية. يرجى المحاولة مرة أخرى.", // AR: needs native review
  },
  AUTH_OTP_ATTEMPTS_EXCEEDED: {
    status: 400,
    en: "Too many incorrect attempts. Please request a new code.",
    ar: "محاولات خاطئة كثيرة جدًا. يرجى طلب رمز جديد.", // AR: needs native review
  },
  AUTH_OTP_RESEND_TOO_SOON: {
    status: 429,
    en: "Please wait before requesting another code.",
    ar: "يرجى الانتظار قبل طلب رمز آخر.", // AR: needs native review
  },
  AUTH_RESET_TOKEN_INVALID: {
    status: 400,
    en: "Your reset session has expired. Please start again.",
    ar: "انتهت صلاحية جلسة إعادة التعيين. يرجى البدء من جديد.", // AR: needs native review
  },
  AUTH_SETUP_LINK_INVALID: {
    status: 400,
    en: "This link is invalid or has expired. Ask your administrator to resend it.",
    ar: "هذا الرابط غير صالح أو منتهي الصلاحية. اطلب من المسؤول إعادة إرساله.", // AR: needs native review
  },
  AUTH_PASSWORD_WEAK: {
    status: 400,
    en: "Password must be 8–72 characters and include an uppercase letter, a lowercase letter, a number and a special character.",
    // AR: needs native review
    ar: "يجب أن تتكون كلمة المرور من 8 إلى 72 حرفًا وأن تحتوي على حرف كبير وحرف صغير ورقم ورمز خاص.",
  },
  AUTH_PASSWORD_MISMATCH: {
    status: 400,
    en: "Passwords do not match",
    ar: "كلمتا المرور غير متطابقتين",
  },
  AUTH_PASSWORD_SAME: {
    status: 400,
    en: "New password must be different from your current one.",
    ar: "يجب أن تكون كلمة المرور الجديدة مختلفة عن كلمة المرور الحالية.", // AR: needs native review
  },
  AUTH_CURRENT_PASSWORD_WRONG: {
    status: 400,
    en: "Your current password is incorrect.",
    ar: "كلمة المرور الحالية غير صحيحة.", // AR: needs native review
  },
  AUTH_EMAIL_TAKEN: {
    status: 409,
    en: "An account with this email already exists. Log in or reset your password.",
    ar: "يوجد حساب بهذا البريد الإلكتروني بالفعل. سجّل الدخول أو أعد تعيين كلمة المرور.", // AR: needs native review
  },
  ACCOUNT_EMAIL_IN_OTHER_COMPANY: {
    status: 409,
    en: "This email is already used by another company.",
    ar: "هذا البريد الإلكتروني مستخدم بالفعل لدى شركة أخرى.", // AR: needs native review
  },
  ACCOUNT_ADMIN_EXISTS: {
    status: 409,
    en: "This company already has an owner. Add other admins as Sub Admin.",
    ar: "لهذه الشركة مالك بالفعل. أضف المسؤولين الآخرين بصفة مسؤول فرعي.", // AR: needs native review
  },
  ACCOUNT_OWNER_PROTECTED: {
    status: 403,
    en: "The company owner's account can't be changed.",
    ar: "لا يمكن تغيير حساب مالك الشركة.", // AR: needs native review
  },
  SESSION_REVOKE_CURRENT: {
    status: 400,
    en: "You can't end your current session here. Use Log out instead.",
    ar: "لا يمكنك إنهاء جلستك الحالية من هنا. استخدم تسجيل الخروج بدلًا من ذلك.", // AR: needs native review
  },
  COMPANY_LOGO_INVALID: {
    status: 400,
    en: "Logo must be a JPG or PNG image up to 2 MB.",
    ar: "يجب أن يكون الشعار صورة بصيغة JPG أو PNG بحجم لا يتجاوز 2 ميغابايت.", // AR: needs native review
  },
  COMPANY_TIMEZONE_INVALID: {
    status: 400,
    en: "Choose a valid timezone",
    ar: "اختر منطقة زمنية صحيحة",
  },
  COMPANY_FY_START_INVALID: {
    status: 400,
    en: "Choose a month from 1 to 12",
    ar: "اختر شهرًا من 1 إلى 12",
  },
  COMPANY_FY_START_LOCKED: {
    status: 409,
    en: "The start month can't change after a financial year has been closed.",
    ar: "لا يمكن تغيير شهر البداية بعد إغلاق سنة مالية.",
  },
  DEPARTMENT_NAME_TAKEN: {
    status: 409,
    en: "A department with this name already exists.",
    ar: "يوجد قسم بهذا الاسم بالفعل.", // AR: needs native review
  },
  DEPARTMENT_CODE_TAKEN: {
    status: 409,
    en: "A department with this code already exists.",
    ar: "يوجد قسم بهذا الرمز بالفعل.", // AR: needs native review
  },
  DEPARTMENT_IN_USE: {
    status: 409,
    en: "This department has employees and can't be deleted.",
    ar: "لا يمكن حذف هذا القسم لأنه يضم موظفين.", // AR: needs native review
  },
  DESIGNATION_NAME_TAKEN: {
    status: 409,
    en: "A designation with this name already exists in this department.",
    ar: "يوجد مسمى وظيفي بهذا الاسم بالفعل في هذا القسم.", // AR: needs native review
  },
  DESIGNATION_CODE_TAKEN: {
    status: 409,
    en: "A designation with this code already exists.",
    ar: "يوجد مسمى وظيفي بهذا الرمز بالفعل.", // AR: needs native review
  },
  DESIGNATION_IN_USE: {
    status: 409,
    en: "This designation has employees and can't be deleted.",
    ar: "لا يمكن حذف هذا المسمى الوظيفي لأنه مرتبط بموظفين.", // AR: needs native review
  },

  // ---------- Contract Studio (standards §7.3) ----------
  // {{placeholders}} are filled from `new ErrorHandler(code, { params })`.
  CONTRACT_TYPE_NAME_TAKEN: {
    status: 409,
    en: "A contract type with this name already exists.",
    ar: "يوجد نوع عقد بهذا الاسم بالفعل.", // AR: needs native review
  },
  CONTRACT_TYPE_CODE_TAKEN: {
    status: 409,
    en: "A contract type with this code already exists.",
    ar: "يوجد نوع عقد بهذا الرمز بالفعل.", // AR: needs native review
  },
  CONTRACT_TYPE_IN_USE: {
    status: 409,
    en: "This contract type is in use and can't be deleted. Deactivate it instead.",
    ar: "نوع العقد هذا مستخدم ولا يمكن حذفه. قم بإلغاء تفعيله بدلًا من ذلك.", // AR: needs native review
  },
  CONTRACT_DOCUMENT_INVALID: {
    status: 400,
    en: "Upload a PDF file up to 20 MB and 50 pages.",
    ar: "ارفع ملف PDF بحجم أقصاه 20 ميجابايت و50 صفحة.", // AR: needs native review
  },
  CONTRACT_UPLOAD_LIMIT: {
    status: 400,
    en: "You can upload at most 10 files at a time.",
    ar: "يمكنك رفع 10 ملفات كحد أقصى في المرة الواحدة.", // AR: needs native review
  },
  CONTRACT_DOCUMENT_IN_USE: {
    status: 409,
    en: "This document is used by a template or contract and can't be deleted. Archive it instead.",
    ar: "هذا المستند مستخدم في قالب أو عقد ولا يمكن حذفه. قم بأرشفته بدلًا من ذلك.", // AR: needs native review
  },
  CONTRACT_DOCUMENT_ARCHIVED: {
    status: 409,
    en: "This document is archived and can't be used for templates.",
    ar: "هذا المستند مؤرشف ولا يمكن استخدامه في القوالب.", // AR: needs native review
  },
  CONTRACT_TEMPLATE_IN_USE: {
    status: 409,
    en: "This template is used by contracts and can't be deleted. Archive it instead.",
    ar: "هذا القالب مستخدم في عقود ولا يمكن حذفه. قم بأرشفته بدلًا من ذلك.", // AR: needs native review
  },
  CONTRACT_TEMPLATE_INACTIVE: {
    status: 409,
    en: "This template is archived. Choose an active template.",
    ar: "هذا القالب مؤرشف. اختر قالبًا نشطًا.", // AR: needs native review
  },
  CONTRACT_AUDIENCE_UNSUPPORTED: {
    status: 400,
    en: "Only Employee and Staffing Company contracts are available right now.",
    ar: "تتوفر حاليًا عقود الموظفين وشركات التوظيف فقط.", // AR: needs native review
  },
  CONTRACT_BULK_LIMIT: {
    status: 400,
    en: "You can send to at most 200 recipients at a time.",
    ar: "يمكنك الإرسال إلى 200 مستلم كحد أقصى في المرة الواحدة.", // AR: needs native review
  },
  CONTRACT_FIELD_MISSING: {
    status: 400,
    en: "Some contract values are missing: {{fields}}.",
    ar: "بعض قيم العقد مفقودة: {{fields}}.", // AR: needs native review
  },
  CONTRACT_NO_OPEN_FY: {
    status: 409,
    en: "There's no open financial year for today. Open one before sending contracts.",
    ar: "لا توجد سنة مالية مفتوحة لتاريخ اليوم. افتح سنة مالية قبل إرسال العقود.", // AR: needs native review
  },
  CONTRACT_ACTIVE_EXISTS: {
    status: 409,
    en: "This recipient already has an active contract of this type ({{number}}). Revoke it or wait for it to finish.",
    ar: "لدى هذا المستلم عقد نشط من هذا النوع بالفعل ({{number}}). قم بإلغائه أو انتظر حتى ينتهي.", // AR: needs native review
  },
  CONTRACT_RECIPIENT_INACTIVE: {
    status: 409,
    en: "This recipient is no longer active.",
    ar: "لم يعد هذا المستلم نشطًا.", // AR: needs native review
  },
  CONTRACT_STATUS_INVALID: {
    status: 409,
    en: "This contract can no longer be changed.",
    ar: "لم يعد من الممكن تغيير هذا العقد.", // AR: needs native review
  },
  CONTRACT_ALREADY_SIGNED: {
    status: 409,
    en: "You have already signed this contract.",
    ar: "لقد وقّعت هذا العقد بالفعل.", // AR: needs native review
  },
  CONTRACT_EXPIRED: {
    status: 409,
    en: "This contract has expired. Contact HR for a new one.",
    ar: "انتهت صلاحية هذا العقد. تواصل مع الموارد البشرية للحصول على عقد جديد.", // AR: needs native review
  },
  CONTRACT_REVOKED: {
    status: 409,
    en: "This contract was withdrawn by HR.",
    ar: "سحبت الموارد البشرية هذا العقد.", // AR: needs native review
  },
  CONTRACT_CONSENT_REQUIRED: {
    status: 400,
    en: "Please confirm that you agree to sign electronically.",
    ar: "يرجى تأكيد موافقتك على التوقيع إلكترونيًا.", // AR: needs native review
  },
  CONTRACT_SELF_APPROVAL: {
    status: 403,
    en: "You can't approve a contract you signed yourself.",
    ar: "لا يمكنك اعتماد عقد قمت بتوقيعه بنفسك.", // AR: needs native review
  },
  PAYLOAD_TOO_LARGE: {
    status: 413,
    en: "The request is too large.",
    ar: "الطلب كبير جدًا.", // AR: needs native review
  },
});

// Field message key → { en, ar } for the `errors` map (standards §7.2).
// Joi schemas name these keys in `.messages({ rule: "key" })`; the error
// handler translates them per request. Texts that are also a top-level code
// (AUTH_PASSWORD_WEAK, AUTH_PASSWORD_SAME, AUTH_PASSWORD_MISMATCH,
// COMPANY_TIMEZONE_INVALID, COMPANY_FY_START_INVALID) are used by code instead.
const FIELD_MESSAGES = Object.freeze({
  // Login / Forgot / Sign up
  emailRequired: { en: "Email is required", ar: "البريد الإلكتروني مطلوب" },
  emailInvalid: { en: "Invalid email address", ar: "البريد الإلكتروني غير صالح" },
  passwordRequired: { en: "Password is required", ar: "كلمة المرور مطلوبة" },
  confirmPasswordRequired: { en: "Please confirm your password", ar: "يرجى تأكيد كلمة المرور" },
  companyNameRequired: { en: "Company name is required", ar: "اسم الشركة مطلوب" },
  companyNameMin: {
    en: "Company name must be at least 2 characters",
    ar: "يجب أن يتكون اسم الشركة من حرفين على الأقل",
  },
  companyNameMax: {
    en: "Company name cannot exceed 100 characters",
    ar: "لا يمكن أن يتجاوز اسم الشركة 100 حرف", // AR: needs native review
  },
  nameRequired: { en: "Your name is required", ar: "اسمك مطلوب" },
  nameMin: { en: "Name must be at least 2 characters", ar: "يجب أن يتكون الاسم من حرفين على الأقل" },
  nameMax: {
    en: "Name cannot exceed 100 characters",
    ar: "لا يمكن أن يتجاوز الاسم 100 حرف", // AR: needs native review
  },
  phoneInvalid: { en: "Invalid phone number", ar: "رقم الهاتف غير صالح" },

  // Verify OTP
  otpIncomplete: { en: "Please enter complete OTP", ar: "يرجى إدخال رمز التحقق كاملاً" },

  // Company profile
  industryRequired: { en: "Please select an industry", ar: "يرجى اختيار القطاع" },
  phoneRequired: { en: "Phone is required", ar: "الهاتف مطلوب" },
  phoneDigits: {
    en: "Enter a valid phone number (6–15 digits)",
    ar: "أدخل رقم هاتف صالحًا (من 6 إلى 15 رقمًا)",
  },
  emailEnterValid: { en: "Enter a valid email", ar: "أدخل بريدًا إلكترونيًا صالحًا" },
  addressRequired: { en: "Address is required", ar: "العنوان مطلوب" },
  addressMax: {
    en: "Address cannot exceed 500 characters",
    ar: "لا يمكن أن يتجاوز العنوان 500 حرف", // AR: needs native review
  },

  // Department
  departmentNameRequired: { en: "Department Name is required", ar: "اسم القسم مطلوب" },
  departmentNameMin: { en: "Department Name must be at least 2 characters", ar: "يجب ألا يقل اسم القسم عن حرفين" },
  departmentNameMax: {
    en: "Department Name cannot exceed 150 characters",
    ar: "لا يمكن أن يتجاوز اسم القسم 150 حرفًا",
  },
  departmentNameNoEmoji: {
    en: "Department Name cannot contain emojis",
    ar: "لا يمكن أن يحتوي اسم القسم على رموز تعبيرية",
  },
  departmentCodeRequired: { en: "Dept. Code is required", ar: "رمز القسم مطلوب" },
  departmentCodeMax: { en: "Dept. Code cannot exceed 50 characters", ar: "لا يمكن أن يتجاوز رمز القسم 50 حرفًا" },
  departmentCodeNoEmoji: {
    en: "Dept. Code cannot contain emojis",
    ar: "لا يمكن أن يحتوي رمز القسم على رموز تعبيرية",
  },
  descriptionMax: { en: "Description cannot exceed 2000 characters", ar: "لا يمكن أن يتجاوز الوصف 2000 حرف" },
  descriptionNoEmoji: {
    en: "Description cannot contain emojis",
    ar: "لا يمكن أن يحتوي الوصف على رموز تعبيرية",
  },
  departmentHeadInvalid: {
    en: "Select an active employee of this company.",
    ar: "اختر موظفًا نشطًا في هذه الشركة.", // AR: needs native review
  },

  // Designation
  designationNameRequired: { en: "Designation Name is required", ar: "اسم المسمى الوظيفي مطلوب" },
  designationNameMin: {
    en: "Designation Name must be at least 2 characters",
    ar: "يجب ألا يقل اسم المسمى الوظيفي عن حرفين",
  },
  designationNameMax: {
    en: "Designation Name cannot exceed 150 characters",
    ar: "لا يمكن أن يتجاوز اسم المسمى الوظيفي 150 حرفًا",
  },
  designationNameNoEmoji: {
    en: "Designation Name cannot contain emojis",
    ar: "لا يمكن أن يحتوي اسم المسمى الوظيفي على رموز تعبيرية",
  },
  designationCodeMax: {
    en: "Designation Code cannot exceed 50 characters",
    ar: "لا يمكن أن يتجاوز رمز المسمى الوظيفي 50 حرفًا",
  },
  designationCodeNoEmoji: {
    en: "Designation Code cannot contain emojis",
    ar: "لا يمكن أن يحتوي رمز المسمى الوظيفي على رموز تعبيرية",
  },

  // ---------- Contract Studio (standards §7.3) ----------
  // Contract type
  contractTypeNameRequired: { en: "Contract Type Name is required", ar: "اسم نوع العقد مطلوب" },
  contractTypeNameMax: { en: "Name cannot exceed 150 characters", ar: "يجب ألا يتجاوز الاسم 150 حرفًا" },
  noEmojis: { en: "Emojis are not allowed", ar: "لا يُسمح باستخدام الرموز التعبيرية" },
  codeRequired: { en: "Code is required", ar: "الرمز مطلوب" },
  codeMin: { en: "Code must be at least 2 characters", ar: "يجب ألا يقل الرمز عن حرفين" },
  codeMax100: { en: "Code cannot exceed 100 characters", ar: "يجب ألا يتجاوز الرمز 100 حرف" },
  descriptionMax500: { en: "Description cannot exceed 500 characters", ar: "يجب ألا يتجاوز الوصف 500 حرف" },

  // Document rename
  documentNameRequired: {
    en: "Document name is required",
    ar: "اسم المستند مطلوب", // AR: needs native review
  },
  documentNameMax: {
    en: "Document name cannot exceed 255 characters",
    ar: "لا يمكن أن يتجاوز اسم المستند 255 حرفًا", // AR: needs native review
  },

  // Template
  templateNameRequired: { en: "Give the template a name.", ar: "أدخل اسمًا للقالب." },
  templateNameMax: {
    en: "Template name cannot exceed 255 characters",
    ar: "لا يمكن أن يتجاوز اسم القالب 255 حرفًا", // AR: needs native review
  },
  templateDocumentRequired: { en: "Select a source document first.", ar: "اختر مستندًا مصدرًا أولًا." },
  templateFieldsRequired: { en: "Add at least one field or column.", ar: "أضف حقلًا أو عمودًا واحدًا على الأقل." },
  templateSignatureRequired: {
    en: "Add at least one signature field.",
    ar: "أضف حقل توقيع واحدًا على الأقل.", // AR: needs native review
  },
  templateFieldOutsidePage: {
    en: "Fields must sit inside the page.",
    ar: "يجب أن تكون الحقول داخل الصفحة.", // AR: needs native review
  },
  templateSignatureLimit: {
    en: "A template can have at most 20 signature and initials fields",
    ar: "يمكن أن يحتوي القالب على 20 حقلًا للتوقيع والأحرف الأولى كحد أقصى", // AR: needs native review
  },
  templateFieldLimit: {
    en: "A template can have at most 200 fields",
    ar: "يمكن أن يحتوي القالب على 200 حقل كحد أقصى", // AR: needs native review
  },
  templateLabelMax: {
    en: "Label cannot exceed 160 characters",
    ar: "لا يمكن أن يتجاوز العنوان 160 حرفًا", // AR: needs native review
  },
  contractTypeRequired: {
    en: "Choose a contract type",
    ar: "اختر نوع العقد", // AR: needs native review
  },
  mergeFieldUnknown: {
    en: "Unknown merge field",
    ar: "حقل دمج غير معروف", // AR: needs native review
  },

  // Draft / send
  contractTemplateRequired: { en: "Pick a template to continue.", ar: "اختر قالبًا للمتابعة." },
  contractRecipientsRequired: { en: "Select at least one recipient.", ar: "حدِّد مستلمًا واحدًا على الأقل." },
  contractNameMax: {
    en: "Contract name cannot exceed 255 characters",
    ar: "لا يمكن أن يتجاوز اسم العقد 255 حرفًا", // AR: needs native review
  },
  startDateRequired: { en: "Start date is required", ar: "تاريخ البدء مطلوب" },
  dateInvalid: { en: "Enter a valid date (YYYY-MM-DD)", ar: "أدخل تاريخًا صالحًا (YYYY-MM-DD)" },
  endDateBeforeStart: {
    en: "End date must be on or after the start date",
    ar: "يجب أن يكون تاريخ الانتهاء في تاريخ البدء أو بعده",
  },
  endDatePast: {
    en: "End date can't be in the past",
    ar: "لا يمكن أن يكون تاريخ الانتهاء في الماضي", // AR: needs native review
  },
  renewalDueRange: {
    en: "Renewal due must be between the start and end dates",
    ar: "يجب أن يكون موعد التجديد بين تاريخي البدء والانتهاء", // AR: needs native review
  },
  signByRange: {
    en: "Sign-by date must be between tomorrow and 90 days from today",
    ar: "يجب أن يكون تاريخ آخر موعد للتوقيع بين الغد و90 يومًا من اليوم", // AR: needs native review
  },
  rateInvalid: {
    en: "Rate must be a positive amount with up to 2 decimals",
    ar: "يجب أن يكون السعر مبلغًا موجبًا بخانتين عشريتين كحد أقصى", // AR: needs native review
  },
  rateUnitRequired: {
    en: "Choose how the rate is paid",
    ar: "اختر طريقة دفع السعر", // AR: needs native review
  },
  currencyInvalid: {
    en: "Choose a valid currency",
    ar: "اختر عملة صالحة", // AR: needs native review
  },
  noticePeriodRange: {
    en: "Notice period must be 0–365 days",
    ar: "يجب أن تكون فترة الإشعار من 0 إلى 365 يومًا", // AR: needs native review
  },

  // Sign (submit)
  fieldRequired: {
    en: "This field is required",
    ar: "هذا الحقل مطلوب", // AR: needs native review
  },
  inputMax500: {
    en: "This field cannot exceed 500 characters",
    ar: "لا يمكن أن يتجاوز هذا الحقل 500 حرف", // AR: needs native review
  },
  signatureLength: {
    en: "Signature must be 2–100 characters",
    ar: "يجب أن يتكون التوقيع من 2 إلى 100 حرف", // AR: needs native review
  },
  initialsLength: {
    en: "Initials must be 1–10 characters",
    ar: "يجب أن تتكون الأحرف الأولى من 1 إلى 10 أحرف", // AR: needs native review
  },
  signatureImageInvalid: {
    en: "Signature image is invalid or too large",
    ar: "صورة التوقيع غير صالحة أو كبيرة جدًا", // AR: needs native review
  },

  // Reject / Revoke
  contractReasonRequired: { en: "Reason is required", ar: "السبب مطلوب" },
  contractReasonMin: {
    en: "Reason must be at least 10 characters",
    ar: "يجب ألا يقل السبب عن 10 أحرف", // AR: needs native review
  },
  contractReasonMax: {
    en: "Reason cannot exceed 500 characters",
    ar: "لا يمكن أن يتجاوز السبب 500 حرف", // AR: needs native review
  },

  // Stored auto-revoke reason (shown in the activity log).
  recipientNoLongerActive: {
    en: "Recipient is no longer active.",
    ar: "لم يعد المستلم نشطًا.", // AR: needs native review
  },
});

module.exports = { MESSAGES, FIELD_MESSAGES };

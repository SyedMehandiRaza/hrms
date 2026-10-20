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
  // Workforce + lifecycle (docs/plans/workforce-and-lifecycle.md)
  OFFICE_NAME_TAKEN: {
    status: 409,
    en: "A head office with this name already exists.",
    ar: "يوجد مكتب رئيسي بهذا الاسم بالفعل.", // AR: needs native review
  },
  OFFICE_IN_USE: {
    status: 409,
    en: "This head office has a project and can't be deleted.",
    ar: "هذا المكتب الرئيسي مرتبط بمشروع ولا يمكن حذفه.", // AR: needs native review
  },
  OFFICE_IMAGE_INVALID: {
    status: 400,
    en: "Image must be a JPG or PNG up to 2 MB.",
    ar: "يجب أن تكون الصورة بصيغة JPG أو PNG وبحجم لا يتجاوز 2 ميغابايت.", // AR: needs native review
  },
  PROJECT_IMAGE_INVALID: {
    status: 400,
    en: "Image must be a JPG or PNG up to 2 MB.",
    ar: "يجب أن تكون الصورة بصيغة JPG أو PNG وبحجم لا يتجاوز 2 ميغابايت.", // AR: needs native review
  },
  PROJECT_NAME_TAKEN: {
    status: 409,
    en: "A project with this name already exists.",
    ar: "يوجد مشروع بهذا الاسم بالفعل.", // AR: needs native review
  },
  PROJECT_OFFICE_TAKEN: {
    status: 409,
    en: "This head office already has a project.",
    ar: "هذا المكتب الرئيسي لديه مشروع بالفعل.", // AR: needs native review
  },
  PROJECT_HAS_EMPLOYEES: {
    status: 409,
    en: "Move this project's employees to another main project before completing it.",
    ar: "انقل موظفي هذا المشروع إلى مشروع رئيسي آخر قبل إكماله.", // AR: needs native review
  },
  PROJECT_START_AFTER_ASSIGNMENTS: {
    status: 409,
    en: "Some employees were assigned before this date.",
    ar: "تم تعيين بعض الموظفين قبل هذا التاريخ.", // AR: needs native review
  },
  PROJECT_NOT_ACTIVE: {
    status: 409,
    en: "Only active projects can take new employees.",
    ar: "يمكن للمشاريع النشطة فقط استقبال موظفين جدد.", // AR: needs native review
  },
  PROJECT_GENERAL_EMPLOYEE_SINGLE: {
    status: 409,
    en: "General employees can belong to only one project.",
    ar: "يمكن أن ينتمي الموظف العام إلى مشروع واحد فقط.", // AR: needs native review
  },
  PROJECT_REMOVE_MAIN: {
    status: 409,
    en: "This is the employee's main project. Change their main project first.",
    ar: "هذا هو المشروع الرئيسي للموظف. غيّر مشروعه الرئيسي أولًا.", // AR: needs native review
  },
  APPROVAL_GROUP_NAME_TAKEN: {
    status: 409,
    en: "An approval group with this name already exists.",
    ar: "توجد مجموعة موافقة بهذا الاسم بالفعل.", // AR: needs native review
  },
  APPROVAL_GROUP_CODE_TAKEN: {
    status: 409,
    en: "An approval group with this code already exists.",
    ar: "توجد مجموعة موافقة بهذا الرمز بالفعل.", // AR: needs native review
  },
  APPROVAL_GROUP_IN_USE: {
    status: 409,
    en: "This approval group is in use and can't be removed.",
    ar: "مجموعة الموافقة هذه قيد الاستخدام ولا يمكن إزالتها.", // AR: needs native review
  },
  APPROVAL_GROUP_HAS_PENDING: {
    status: 409,
    en: "This group has pending requests. Decide them before removing levels.",
    ar: "لدى هذه المجموعة طلبات معلقة. قرّر بشأنها قبل إزالة المستويات.", // AR: needs native review
  },
  APPROVAL_GROUP_PROJECT_MISMATCH: {
    status: 409,
    en: "This approval group belongs to a different project.",
    ar: "تنتمي مجموعة الموافقة هذه إلى مشروع مختلف.", // AR: needs native review
  },
  APPROVAL_ROUTING_PER_MODULE_DISABLED: {
    status: 400,
    en: "Per-module routing isn't available yet.",
    ar: "التوجيه حسب الوحدة غير متاح بعد.", // AR: needs native review
  },
  APPROVAL_NOT_YOUR_TURN: {
    status: 403,
    en: "This request isn't waiting for your approval.",
    ar: "هذا الطلب لا ينتظر موافقتك.", // AR: needs native review
  },
  APPROVAL_ALREADY_DECIDED: {
    status: 409,
    en: "This request has already been decided.",
    ar: "تم البت في هذا الطلب بالفعل.", // AR: needs native review
  },
  LEAVE_TYPE_NAME_TAKEN: {
    status: 409,
    en: "A leave type with this name already exists.",
    ar: "يوجد نوع إجازة بهذا الاسم بالفعل.", // AR: needs native review
  },
  LEAVE_TYPE_CODE_TAKEN: {
    status: 409,
    en: "A leave type with this code already exists.",
    ar: "يوجد نوع إجازة بهذا الرمز بالفعل.", // AR: needs native review
  },
  LEAVE_TYPE_IN_USE: {
    status: 409,
    en: "This leave type is assigned to employees and can't be deleted.",
    ar: "نوع الإجازة هذا مُعيَّن لموظفين ولا يمكن حذفه.", // AR: needs native review
  },
  LEAVE_POLICY_VERSIONING_DISABLED: {
    status: 409,
    en: "Policy versions aren't available yet.",
    ar: "إصدارات السياسة غير متاحة بعد.", // AR: needs native review
  },
  SHIFT_NAME_TAKEN: {
    status: 409,
    en: "A shift with this name already exists.",
    ar: "توجد وردية بهذا الاسم بالفعل.", // AR: needs native review
  },
  SHIFT_IN_USE: {
    status: 409,
    en: "This shift is assigned to employees and can't be deleted.",
    ar: "هذه الوردية مُعيَّنة لموظفين ولا يمكن حذفها.", // AR: needs native review
  },
  SHIFT_WEEKOFF_LOCKED: {
    status: 409,
    en: "Week-offs in a closed or past period can't be changed.",
    ar: "لا يمكن تغيير أيام الراحة الأسبوعية في فترة مغلقة أو سابقة.", // AR: needs native review
  },
  SALARY_COMPONENT_NAME_TAKEN: {
    status: 409,
    en: "A salary component with this name already exists.",
    ar: "يوجد مكوّن راتب بهذا الاسم بالفعل.", // AR: needs native review
  },
  SALARY_COMPONENT_SYSTEM: {
    status: 403,
    en: "Default components can't be changed.",
    ar: "لا يمكن تغيير المكوّنات الافتراضية.", // AR: needs native review
  },
  SALARY_COMPONENT_TYPE_LOCKED: {
    status: 409,
    en: "The type can't change once employees use this component.",
    ar: "لا يمكن تغيير النوع بعد أن يستخدم الموظفون هذا المكوّن.", // AR: needs native review
  },
  EMPLOYEE_ID_NUMBER_TAKEN: {
    status: 409,
    en: "An employee with this ID number already exists.",
    ar: "يوجد موظف برقم الهوية هذا بالفعل.", // AR: needs native review
  },
  EMPLOYEE_EMAIL_TAKEN: {
    status: 409,
    en: "An employee with this email already exists.",
    ar: "يوجد موظف بهذا البريد الإلكتروني بالفعل.", // AR: needs native review
  },
  EMPLOYEE_PHONE_TAKEN: {
    status: 409,
    en: "An employee with this phone number already exists.",
    ar: "يوجد موظف برقم الهاتف هذا بالفعل.", // AR: needs native review
  },
  EMPLOYEE_EXITED: {
    status: 409,
    en: "This employee has exited. Use Rehire.",
    ar: "غادر هذا الموظف. استخدم إعادة التوظيف.", // AR: needs native review
  },
  EXIT_ALREADY_OPEN: {
    status: 409,
    en: "This employee already has an open exit.",
    ar: "لدى هذا الموظف طلب إنهاء خدمة مفتوح بالفعل.", // AR: needs native review
  },
  EXIT_INVALID_STATE: {
    status: 409,
    en: "This action isn't possible in the exit's current status.",
    ar: "هذا الإجراء غير ممكن في الحالة الحالية لإنهاء الخدمة.", // AR: needs native review
  },
  SHIFT_WEEKOFF_NO_NEXT_FY: {
    status: 409,
    en: "The next financial year doesn't exist or is locked.",
    ar: "السنة المالية التالية غير موجودة أو مقفلة.", // AR: needs native review
  },
  REHIRE_NOT_ALLOWED: {
    status: 409,
    en: "This employee isn't eligible for rehire until {date}.",
    ar: "هذا الموظف غير مؤهل لإعادة التوظيف حتى {date}.", // AR: needs native review
  },
  REHIRE_NOT_ELIGIBLE: {
    status: 409,
    en: "This employee isn't eligible for rehire.",
    ar: "هذا الموظف غير مؤهل لإعادة التوظيف.", // AR: needs native review
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

  // Countries, cities, phones
  phoneNumberRequired: { en: "Phone number is required", ar: "رقم الهاتف مطلوب" },
  phoneInvalidForCountry: { en: "Enter a valid phone number for the selected country.", ar: "أدخل رقم هاتف صالحًا للدولة المحددة." }, // AR: needs native review
  phoneCountryRequired: { en: "Select the phone number's country.", ar: "اختر دولة رقم الهاتف." }, // AR: needs native review
  countryRequired: { en: "Select a country.", ar: "اختر دولة." }, // AR: needs native review
  cityNotInCountry: { en: "Select a city in the selected country.", ar: "اختر مدينة في الدولة المحددة." }, // AR: needs native review
  nationalityRequired: { en: "Please select a nationality", ar: "يرجى اختيار الجنسية" },

  // Head office
  officeNameRequired: { en: "Head office name is required", ar: "اسم المكتب الرئيسي مطلوب" },
  min2CharsRequired: { en: "At least 2 characters required", ar: "يلزم حرفان على الأقل" },
  officeNameMax: { en: "Head office name cannot exceed 100 characters", ar: "لا يمكن أن يتجاوز اسم المكتب الرئيسي 100 حرف" }, // AR: needs native review
  officeNameChars: { en: "Only letters, numbers, apostrophes and single spaces allowed", ar: "يُسمح فقط بالأحرف والأرقام والفواصل العليا والمسافات المفردة" },
  multipleSpaces: { en: "Multiple spaces are not allowed", ar: "لا يُسمح بالمسافات المتعددة" },
  emailValidAddress: { en: "Enter a valid email address", ar: "أدخل بريدًا إلكترونيًا صالحًا" },
  locationRequired: { en: "Location is required", ar: "الموقع مطلوب" },
  min3Chars: { en: "At least 3 characters", ar: "3 أحرف على الأقل" },
  max255Allowed: { en: "Maximum 255 characters allowed", ar: "255 حرفًا كحد أقصى" },
  locationFormat: { en: "Invalid location format", ar: "صيغة الموقع غير صالحة" },
  latitudeInvalid: { en: "Enter a valid latitude", ar: "أدخل خط عرض صالحًا" }, // AR: needs native review
  longitudeInvalid: { en: "Enter a valid longitude", ar: "أدخل خط طول صالحًا" }, // AR: needs native review

  // Project
  projectNameRequired: { en: "Project name is required", ar: "اسم المشروع مطلوب" },
  projectNameMax: { en: "Project name cannot exceed 255 characters", ar: "لا يمكن أن يتجاوز اسم المشروع 255 حرفًا" },
  invalidCharsUsed: { en: "Invalid characters used", ar: "تم استخدام أحرف غير صالحة" },
  officeSelect: { en: "Please select an office from the list", ar: "يرجى اختيار مكتب من القائمة" },
  startDateRequired: { en: "Start date is required", ar: "تاريخ البداية مطلوب" },
  endDateRequired: { en: "End date is required", ar: "تاريخ النهاية مطلوب" },
  endAfterStart: { en: "End date must be after start date", ar: "يجب أن يكون تاريخ النهاية بعد تاريخ البداية" },
  mapLocationRequired: { en: "Please select a location on the map", ar: "يرجى تحديد موقع على الخريطة" },
  radiusRequired: { en: "Radius is required", ar: "النطاق مطلوب" },
  radiusMin: { en: "Radius must be at least 50 meters", ar: "يجب ألا يقل نصف القطر عن 50 مترًا" },
  radiusMax: { en: "Radius cannot exceed 100,000 meters", ar: "لا يمكن أن يتجاوز نصف القطر 100,000 متر" },
  descriptionMax1000: { en: "Description cannot exceed 1000 characters", ar: "لا يمكن أن يتجاوز الوصف 1000 حرف" },
  statusChangeNotAllowed: { en: "This status change isn't allowed.", ar: "تغيير الحالة هذا غير مسموح به." }, // AR: needs native review
  assignSelectEmployee: { en: "Select at least one employee to assign", ar: "اختر موظفًا واحدًا على الأقل لتعيينه" },
  assignInNoticeOrExited: { en: "In-notice or exited employees can't be assigned.", ar: "لا يمكن تعيين الموظفين في فترة الإشعار أو الموظفين المغادرين." }, // AR: needs native review

  // Shift, week-offs
  shiftNameRequired: { en: "Shift Name is required", ar: "اسم الوردية مطلوب" },
  shiftNameMax: { en: "Shift Name cannot exceed 50 characters", ar: "لا يمكن أن يتجاوز اسم الوردية 50 حرفًا" }, // AR: needs native review
  startTimeRequired: { en: "Start Time is required", ar: "وقت البدء مطلوب" },
  endTimeRequired: { en: "End Time is required", ar: "وقت الانتهاء مطلوب" },
  endTimeSameAsStart: { en: "End time must differ from start time.", ar: "يجب أن يختلف وقت الانتهاء عن وقت البدء." }, // AR: needs native review
  shiftEffectiveFromInvalid: { en: "Choose a date from the start of the financial year that isn't in a closed or locked period.", ar: "اختر تاريخًا من بداية السنة المالية لا يقع في فترة مغلقة أو مقفلة." }, // AR: needs native review
  weekOffOutsideFy: { en: "Every date must fall in an existing financial year.", ar: "يجب أن يقع كل تاريخ ضمن سنة مالية موجودة." }, // AR: needs native review

  // Leave type / policy
  leaveNameRequired: { en: "Leave Name is required", ar: "اسم الإجازة مطلوب" },
  mustMin2Chars: { en: "Must be at least 2 characters", ar: "يجب أن يتكون من حرفين على الأقل" },
  max150Chars: { en: "Cannot exceed 150 characters", ar: "لا يمكن أن يتجاوز 150 حرفًا" },
  emojisNotAllowed: { en: "Emojis are not allowed", ar: "لا يُسمح باستخدام الرموز التعبيرية" },
  leaveCodeRequired: { en: "Leave Code is required", ar: "رمز الإجازة مطلوب" },
  leaveCodeFormat: { en: "Leave Code must be 1–10 letters or numbers", ar: "يجب أن يتكون رمز الإجازة من 1 إلى 10 أحرف أو أرقام" }, // AR: needs native review
  quotaRange: { en: "Yearly quota must be 0–365 days", ar: "يجب أن تكون الحصة السنوية بين 0 و365 يومًا" },
  accrualMethodRequired: { en: "Choose monthly accrual or upfront", ar: "اختر الاستحقاق الشهري أو المنح مقدمًا" },
  monthlyAccrualNegative: { en: "Monthly accrual can't be negative", ar: "لا يمكن أن يكون الاستحقاق الشهري سالبًا" }, // AR: needs native review
  effectiveToAfter: { en: "effective_to must be after effective_from", ar: "يجب أن يكون effective_to بعد effective_from" },
  maxCarryForward: { en: "max_carry_forward_days must be greater than 0 when carry forward is allowed", ar: "يجب أن يكون max_carry_forward_days أكبر من 0 عند السماح بالترحيل" },
  carryExpiry: { en: "Carry-forward expiry must be a whole number of months from 0 to 36", ar: "يجب أن تكون مدة انتهاء الرصيد المُرحّل عددًا صحيحًا من الأشهر بين 0 و36" },
  maxEncashment: { en: "max_encashment_days must be greater than 0 when encashment is allowed", ar: "يجب أن يكون max_encashment_days أكبر من 0 عند السماح بالصرف النقدي" },
  yearEndExcess: { en: "Choose lapse or encash", ar: "اختر الإسقاط أو الصرف النقدي" },

  // Salary component
  componentNameRequired: { en: "Component Name is required", ar: "اسم المكوّن مطلوب" },
  componentNameLength: { en: "Component Name must be 2–100 characters", ar: "يجب أن يتكون اسم المكوّن من 2 إلى 100 حرف" }, // AR: needs native review
  componentTypeRequired: { en: "Component Type is required", ar: "نوع المكوّن مطلوب" },
  descriptionMax255: { en: "Description cannot exceed 255 characters", ar: "لا يمكن أن يتجاوز الوصف 255 حرفًا" }, // AR: needs native review

  // Approval group, decisions
  groupNameRequired: { en: "Group name is required", ar: "اسم المجموعة مطلوب" },
  min2Chars: { en: "At least 2 characters", ar: "حرفان على الأقل" },
  max100OrLess: { en: "Must be 100 characters or less", ar: "يجب ألا يتجاوز 100 حرف" },
  groupCodeRequired: { en: "Group code is required", ar: "رمز المجموعة مطلوب" },
  max50OrLess: { en: "Must be 50 characters or less", ar: "يجب ألا يتجاوز 50 حرفًا" },
  max1000OrLess: { en: "Must be 1000 characters or less", ar: "يجب ألا يتجاوز 1000 حرف" },
  projectSelect: { en: "Please select a project", ar: "يرجى اختيار مشروع" },
  projectApproverRequired: { en: "At least one approver must be an employee of the selected project.", ar: "يجب أن يكون موافِق واحد على الأقل موظفًا في المشروع المحدد." },
  approverRequired: { en: "Add at least one approver", ar: "أضف موافِقًا واحدًا على الأقل" },
  approverDuplicate: { en: "Employee cannot be selected multiple times. Each employee can only appear once in the approval hierarchy.", ar: "لا يمكن اختيار الموظف أكثر من مرة. يمكن أن يظهر كل موظف مرة واحدة فقط في تسلسل الموافقة." },
  levelsContiguous: { en: "Levels must start at 1 with no gaps.", ar: "يجب أن تبدأ المستويات من 1 دون فجوات." }, // AR: needs native review
  reason5to500: { en: "Reason must be 5–500 characters", ar: "يجب أن يتكون السبب من 5 إلى 500 حرف" },
  draftTooLarge: { en: "Draft is too large (max 1 MB).", ar: "المسودة كبيرة جدًا (الحد الأقصى 1 ميغابايت)." }, // AR: needs native review

  // Employee (create, edit), main project change
  fullNameRequired: { en: "Full name is required", ar: "الاسم الكامل مطلوب" },
  countryEmpIdRequired: { en: "Country Employee ID is required", ar: "معرّف الموظف الوطني مطلوب" },
  min3CharsRequired: { en: "At least 3 characters required", ar: "يلزم 3 أحرف على الأقل" },
  max10OrLess: { en: "Must be 10 characters or less", ar: "يجب ألا يتجاوز 10 أحرف" },
  idChars: { en: "Only letters, numbers and dashes allowed", ar: "يُسمح بالأحرف والأرقام والشرطات فقط" },
  emailAddressRequired: { en: "Email address is required", ar: "البريد الإلكتروني مطلوب" },
  employmentTypeRequired: { en: "Please select employment type", ar: "يرجى اختيار نوع التوظيف" },
  accessLevelRequired: { en: "Access level is required", ar: "مستوى الوصول مطلوب" },
  accessLevelInvalid: { en: "Choose Employee, General employee or Sub admin.", ar: "اختر موظف أو موظف عام أو مسؤول فرعي." }, // AR: needs native review
  roleRequired: { en: "Role is required", ar: "الدور مطلوب" },
  projectRequired: { en: "Select at least one project", ar: "اختر مشروعًا واحدًا على الأقل" },
  generalOneProject: { en: "A General Employee can be assigned to only one project", ar: "يمكن تعيين الموظف العام إلى مشروع واحد فقط" },
  projectsActiveOnly: { en: "Select active projects only.", ar: "اختر مشاريع نشطة فقط." }, // AR: needs native review
  mainProjectRequired: { en: "Select a main project", ar: "اختر المشروع الرئيسي" },
  mainProjectInSelection: { en: "Main project must be one of the selected projects", ar: "يجب أن يكون المشروع الرئيسي أحد المشاريع المختارة" },
  joiningBeforeProjectStart: { en: "Joining date can't be before the main project's start date.", ar: "لا يمكن أن يكون تاريخ الالتحاق قبل تاريخ بدء المشروع الرئيسي." }, // AR: needs native review
  joiningTooFar: { en: "Joining date can't be more than 12 months ahead.", ar: "لا يمكن أن يكون تاريخ الالتحاق بعد أكثر من 12 شهرًا." }, // AR: needs native review
  departmentActive: { en: "Select an active department.", ar: "اختر قسمًا نشطًا." }, // AR: needs native review
  designationActive: { en: "Select an active designation of this department.", ar: "اختر مسمى وظيفيًا نشطًا في هذا القسم." }, // AR: needs native review
  staffingContractOnly: { en: "A staffing company applies only to contract employees.", ar: "تنطبق شركة التوظيف على موظفي العقود فقط." }, // AR: needs native review
  staffingActive: { en: "Select an active staffing company.", ar: "اختر شركة توظيف نشطة." }, // AR: needs native review
  leavePolicyRequired: { en: "Select at least one leave policy", ar: "اختر سياسة إجازة واحدة على الأقل" },
  leavePolicyPerType: { en: "Choose one policy per leave type.", ar: "اختر سياسة واحدة لكل نوع إجازة." }, // AR: needs native review
  leavePoliciesActive: { en: "Select active leave policies only.", ar: "اختر سياسات إجازة نشطة فقط." }, // AR: needs native review
  approvalGroupRequired: { en: "Select an approval group.", ar: "اختر مجموعة موافقة." }, // AR: needs native review
  currencySar: { en: "Currency must be SAR.", ar: "يجب أن تكون العملة SAR." }, // AR: needs native review
  salaryModeInvalid: { en: "This salary mode isn't available for this employment type.", ar: "وضع الراتب هذا غير متاح لنوع التوظيف هذا." }, // AR: needs native review
  componentRequired: { en: "Add at least one salary component", ar: "أضف مكوّن راتب واحدًا على الأقل" },
  defaultComponentsRequired: { en: "Basic, Housing and Transport are required.", ar: "الراتب الأساسي وبدل السكن وبدل النقل مطلوبة." }, // AR: needs native review
  amountEveryRow: { en: "Enter a valid amount (≥ 0) for every component", ar: "أدخل مبلغًا صالحًا (≥ 0) لكل مكوّن" },
  basicPositive: { en: "Basic salary must be more than 0.", ar: "يجب أن يكون الراتب الأساسي أكبر من 0." }, // AR: needs native review
  duplicateComponent: { en: "A component is selected more than once", ar: "تم اختيار مكوّن أكثر من مرة" },
  percentMax: { en: "A percentage component cannot exceed 100", ar: "لا يمكن أن يتجاوز المكوّن النسبي 100" },
  componentsActive: { en: "Select active components only.", ar: "اختر مكوّنات نشطة فقط." }, // AR: needs native review
  workingHours: { en: "Enter working hours per day (1–24)", ar: "أدخل ساعات العمل اليومية (1–24)" },
  hourlyRate: { en: "Enter an hourly rate greater than 0", ar: "أدخل سعر ساعة أكبر من 0" },
  minHours: { en: "Minimum hours must be ≥ 0", ar: "يجب أن يكون الحد الأدنى للساعات ≥ 0" },
  overtimeRate: { en: "Overtime rate must be 1–5 in steps of 0.5.", ar: "يجب أن يكون معدل العمل الإضافي من 1 إلى 5 بخطوات قدرها 0.5." }, // AR: needs native review
  mainProjectEffectiveInvalid: { en: "Effective date must be after the current main project's start, not in the future and not in a locked period.", ar: "يجب أن يكون تاريخ السريان بعد بدء المشروع الرئيسي الحالي، وألا يكون في المستقبل أو في فترة مقفلة." }, // AR: needs native review

  // Exit, rehire
  exitEmployeeInvalid: { en: "Select a valid employee", ar: "اختر موظفًا صالحًا" },
  exitEmployeeSelf: { en: "You cannot raise an exit for yourself", ar: "لا يمكنك تسجيل إنهاء خدمة لنفسك" },
  exitTypeRequired: { en: "Please select the exit type", ar: "يرجى اختيار نوع إنهاء الخدمة" },
  exitReasonCategory: { en: "Please select a reason", ar: "يرجى اختيار السبب" },
  exitReason: { en: "Reason must be 10–1000 characters", ar: "يجب أن يتكون السبب من 10 إلى 1000 حرف" },
  noticeStartInvalid: { en: "Enter a valid notice start date (within 90 days)", ar: "أدخل تاريخ بدء إشعار صالحًا (خلال 90 يومًا)" },
  noticeDays: { en: "Notice period must be 0–180 days", ar: "يجب أن تكون فترة الإشعار من 0 إلى 180 يومًا" },
  lwdInvalid: { en: "Enter a valid last working day", ar: "أدخل آخر يوم عمل صالحًا" },
  lwdBeforeStart: { en: "Last working day must be on/after the notice start date", ar: "يجب أن يكون آخر يوم عمل في تاريخ بدء الإشعار أو بعده" },
  lwdPast: { en: "Last working day cannot be in the past", ar: "لا يمكن أن يكون آخر يوم عمل في الماضي" },
  lwdTooFar: { en: "Last working day must be within 365 days of the notice start date", ar: "يجب أن يكون آخر يوم عمل خلال 365 يومًا من تاريخ بدء الإشعار" },
  preferredDayBeforeStart: { en: "Preferred last day must be on/after the notice start date", ar: "يجب أن يكون اليوم الأخير المفضل في تاريخ بدء الإشعار أو بعده" },
  yesNo: { en: "Choose Yes or No", ar: "اختر نعم أو لا" },
  loanHandling: { en: "Choose how the outstanding loan is handled", ar: "اختر طريقة التعامل مع القرض المستحق" },
  coolingDays: { en: "Cooling period must be 0–1095 days", ar: "يجب أن تكون فترة الانتظار من 0 إلى 1095 يومًا" },
  overrideReason: { en: "Override reason must be 10–500 characters", ar: "يجب أن يتكون سبب التجاوز من 10 إلى 500 حرف" },
  rehireDateInvalid: { en: "Enter a valid rehire date", ar: "أدخل تاريخ إعادة توظيف صالحًا" },
  rehireTooFar: { en: "Rehire date cannot be more than 90 days ahead", ar: "لا يمكن أن يتجاوز تاريخ إعادة التوظيف 90 يومًا من اليوم" },
  mainProjectActive: { en: "Select an active main project.", ar: "اختر مشروعًا رئيسيًا نشطًا." }, // AR: needs native review
});

module.exports = { MESSAGES, FIELD_MESSAGES };

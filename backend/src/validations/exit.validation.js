const Joi = require("joi");
const { required, INVALID } = require("./department.validation");
const { isRealDate } = require("./dates");
const { reason } = require("./approval.validation");
const { ACCESS_LEVELS } = require("./employee.validation");

const ACCEPTED_ACCESS_LEVELS = [...ACCESS_LEVELS, "ADMIN"];

// Exits (standards §7.2 "Exit (raise, edit terms)", "Exit settings"; workforce D61, D62). Date
// ranges that depend on today, the notice start or the caller are checked by the service.

const REASONS = {
  RESIGNATION: ["BETTER_OPPORTUNITY", "PERSONAL", "RELOCATION", "HEALTH", "OTHER"],
  TERMINATION: ["PERFORMANCE", "MISCONDUCT", "REDUNDANCY", "CONTRACT_END", "ABSCONDING", "OTHER"],
};
const LOAN_HANDLING = ["RECOVER", "WRITE_OFF", "SETTLED", "NONE"];
const STATUSES = ["PENDING_APPROVAL", "IN_NOTICE", "EXITED", "COMPLETED", "CANCELLED", "REJECTED"];

const date = (key) =>
  Joi.string()
    .trim()
    .empty(["", null])
    .custom((value, helpers) => (isRealDate(value) ? value : helpers.error("date.invalid")))
    .messages({ "string.base": key, "date.invalid": key });
const days = (max, key) =>
  Joi.number().integer().min(0).max(max).empty(["", null]).messages({ "number.base": key, "number.integer": key, "number.min": key, "number.max": key, "number.unsafe": key });
const yesNo = Joi.boolean().strict().empty(null).messages({ "boolean.base": "yesNo" });

// POST /employees/:id/exits. The reason category must belong to the exit type.
const raiseExitSchema = Joi.object({
  exitType: Joi.string()
    .valid(...Object.keys(REASONS))
    .required()
    .messages({ ...required("exitTypeRequired"), "any.only": "exitTypeRequired" }),
  reasonCategory: Joi.string()
    .required()
    .when("exitType", {
      switch: Object.entries(REASONS).map(([type, reasons]) => ({ is: type, then: Joi.valid(...reasons) })),
    })
    .messages({ ...required("exitReasonCategory"), "any.only": "exitReasonCategory" }),
  reason: Joi.string().trim().min(10).max(1000).required().messages({ ...required("exitReason"), "string.min": "exitReason", "string.max": "exitReason" }),
  noticeStartDate: date("noticeStartInvalid"),
  noticeDays: days(180, "noticeDays"),
  lastWorkingDay: date("lwdInvalid"),
  preferredLastDay: date(INVALID),
  allowLeaveDuringNotice: yesNo,
  encashLeave: yesNo,
  rehireEligible: yesNo,
  loanHandling: Joi.string()
    .valid(...LOAN_HANDLING)
    .empty(["", null])
    .messages({ "string.base": "loanHandling", "any.only": "loanHandling" }),
  coolingPeriodDays: days(1095, "coolingDays"),
});

// GET /exits?status=&type=&reason=&lwdMonth=YYYY-MM&search=&page=&limit=
const listExitsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({ "number.base": INVALID, "number.integer": INVALID, "number.min": INVALID, "number.unsafe": INVALID }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": INVALID,
    "number.integer": INVALID,
    "number.min": INVALID,
    "number.max": INVALID,
    "number.unsafe": INVALID,
  }),
  search: Joi.string().trim().max(150).allow("").default("").messages({ "string.base": INVALID, "string.max": INVALID }),
  // One status or a comma-separated list (the Cancelled tab also shows Rejected, D60) → an array.
  status: Joi.string()
    .allow("")
    .default("")
    .custom((value, helpers) => {
      if (value === "") return [];
      const list = value.split(",");
      return list.every((s) => STATUSES.includes(s)) ? [...new Set(list)] : helpers.error("any.only");
    })
    .messages({ "string.base": INVALID, "any.only": INVALID }),
  type: Joi.string()
    .valid(...Object.keys(REASONS))
    .allow("")
    .default("")
    .messages({ "string.base": INVALID, "any.only": INVALID }),
  reason: Joi.string().trim().max(40).allow("").default("").messages({ "string.base": INVALID, "string.max": INVALID }),
  lwdMonth: Joi.string()
    .pattern(/^\d{4}-(0[1-9]|1[0-2])$/)
    .allow("")
    .default("")
    .messages({ "string.base": INVALID, "string.pattern.base": INVALID }),
});

// PUT /exit-settings (defaults for new exits).
const exitSettingsSchema = Joi.object({
  noticeDays: days(180, "noticeDays").required().messages({ "any.required": "noticeDays" }),
  coolingPeriodDays: days(1095, "coolingDays").required().messages({ "any.required": "coolingDays" }),
  allowLeaveDuringNotice: yesNo.required().messages({ "any.required": "yesNo" }),
  encashLeave: yesNo.required().messages({ "any.required": "yesNo" }),
  blockLoansDuringNotice: yesNo.required().messages({ "any.required": "yesNo" }),
});

// PUT /exits/:id/terms (D65): any subset of the notice and settlement terms. The exit type and
// notice start stay; a reason category must belong to the exit's type (checked by the service).
const editTermsSchema = Joi.object({
  reasonCategory: Joi.string().messages({ "string.base": "exitReasonCategory", "string.empty": "exitReasonCategory" }),
  reason: Joi.string().trim().min(10).max(1000).messages({ "string.base": "exitReason", "string.empty": "exitReason", "string.min": "exitReason", "string.max": "exitReason" }),
  noticeDays: days(180, "noticeDays"),
  lastWorkingDay: date("lwdInvalid"),
  preferredLastDay: date(INVALID),
  allowLeaveDuringNotice: yesNo,
  encashLeave: yesNo,
  rehireEligible: yesNo,
  loanHandling: Joi.string()
    .valid(...LOAN_HANDLING)
    .empty(["", null])
    .messages({ "string.base": "loanHandling", "any.only": "loanHandling" }),
  coolingPeriodDays: days(1095, "coolingDays"),
});

// POST /exits/:id/withdraw and /exits/:id/cancel (standards §7.2 "Exit withdraw / cancel").
const withdrawExitSchema = Joi.object({ reason: reason.required() });

// POST /exits/:id/confirm-immediate (standards §7.2 "Exit confirm immediate").
const confirmImmediateSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(500).required().messages({
    "any.required": "overrideReason",
    "string.base": "overrideReason",
    "string.empty": "overrideReason",
    "string.min": "overrideReason",
    "string.max": "overrideReason",
  }),
});

// POST /exits/:id/rehire (standards §7.2 "Rehire", workforce D67): everything optional. Job
// fields given here override the kept ones under the create rules; null or "" clears an
// optional one.
const clearable = Joi.string().trim().allow(null, "").messages({ "string.base": INVALID });
const rehireSchema = Joi.object({
  rehireDate: date("rehireDateInvalid"),
  mainProjectId: Joi.string().trim().empty(["", null]).messages({ "string.base": "mainProjectActive" }),
  employmentType: Joi.string().valid("FULL_TIME", "CONTRACT").messages({ "string.base": "employmentTypeRequired", "any.only": "employmentTypeRequired" }),
  // ADMIN passes here so the service can answer ACCOUNT_ADMIN_EXISTS (D48).
  accessLevel: Joi.string()
    .valid(...ACCEPTED_ACCESS_LEVELS)
    .messages({ "string.base": "accessLevelInvalid", "any.only": "accessLevelInvalid" }),
  roleId: clearable,
  departmentId: clearable,
  designationId: clearable,
  staffingCompanyId: clearable,
});

module.exports = { rehireSchema, raiseExitSchema, editTermsSchema, withdrawExitSchema, confirmImmediateSchema, listExitsSchema, exitSettingsSchema, REASONS, STATUSES };

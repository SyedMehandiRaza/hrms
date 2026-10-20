const Joi = require("joi");
const { INVALID } = require("./department.validation");

// Approval decisions (standards §7.2 "Approval decision", workforce D25, D27): a rejection needs a
// reason of 5–500 characters; an approval may carry a comment.
const reason = Joi.string().trim().min(5).max(500).messages({
  "any.required": "reason5to500",
  "string.base": "reason5to500",
  "string.empty": "reason5to500",
  "string.min": "reason5to500",
  "string.max": "reason5to500",
});

const approveSchema = Joi.object({
  comment: Joi.string().trim().max(500).allow("", null).messages({ "string.base": INVALID, "string.max": INVALID }),
  // Owner override (D27): the reason is required there; checked by the service.
  reason: reason.allow("", null),
});
const rejectSchema = Joi.object({ reason: reason.required() });

module.exports = { approveSchema, rejectSchema };

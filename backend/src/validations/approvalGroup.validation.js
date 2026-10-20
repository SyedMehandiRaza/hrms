const Joi = require("joi");
const { required, INVALID } = require("./department.validation");

// Approval groups (standards §7.2 "Approval group", workforce D17–D22, ADR 0011). Groups aren't
// tied to a module: the only module is ALL (any other → APPROVAL_ROUTING_PER_MODULE_DISABLED,
// checked by the service). Member rules are reported under `members`.

// [{ employeeId, level, isMandatory?, canSkip? }]: at least one, each employee once, levels 1, 2, …
// with no gaps. Whether each employee is an active employee of the company is the service's check.
const membersRule = Joi.array()
  .custom((value, helpers) => {
    if (!value.length) return helpers.error("members.none");
    const shapeOk = value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        typeof m.employeeId === "string" &&
        Number.isInteger(m.level) &&
        m.level >= 1 &&
        (m.isMandatory === undefined || typeof m.isMandatory === "boolean") &&
        (m.canSkip === undefined || typeof m.canSkip === "boolean")
    );
    if (!shapeOk) return helpers.error("members.shape");
    const ids = value.map((m) => m.employeeId.trim());
    if (new Set(ids).size !== ids.length) return helpers.error("members.duplicate");
    const levels = [...new Set(value.map((m) => m.level))].sort((a, b) => a - b);
    if (levels.some((level, i) => level !== i + 1)) return helpers.error("members.levels");
    return value.map((m) => ({
      employeeId: m.employeeId.trim(),
      level: m.level,
      isMandatory: m.isMandatory ?? true,
      canSkip: m.canSkip ?? false,
    }));
  })
  .messages({
    "any.required": "approverRequired",
    "array.base": "approverRequired",
    "members.none": "approverRequired",
    "members.shape": "departmentHeadInvalid",
    "members.duplicate": "approverDuplicate",
    "members.levels": "levelsContiguous",
  });

const details = {
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({ ...required("groupNameRequired"), "string.min": "min2Chars", "string.max": "max100OrLess" }),
  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(50)
    .required()
    .messages({ ...required("groupCodeRequired"), "string.min": "min2Chars", "string.max": "max50OrLess" }),
  description: Joi.string().trim().max(1000).allow("", null).messages({ "string.base": INVALID, "string.max": "max1000OrLess" }),
  scope: Joi.string().valid("GLOBAL", "PROJECT").default("GLOBAL").messages({ "string.base": INVALID, "any.only": INVALID }),
  projectId: Joi.when("scope", {
    is: "PROJECT",
    then: Joi.string().trim().required().messages(required("projectSelect")),
    otherwise: Joi.any().strip(),
  }),
  moduleKey: Joi.string().trim().default("ALL").messages({ "string.base": INVALID }),
};

// POST /approval-groups: details and members.
const createGroupSchema = Joi.object({ ...details, members: membersRule.required() });
// PUT /approval-groups/:id: details only.
const updateGroupSchema = Joi.object(details);
// PUT /approval-groups/:id/members
const membersSchema = Joi.object({ members: membersRule.required() });
// PATCH /approval-groups/:id/status
const statusSchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "INACTIVE").required().messages({ "any.required": INVALID, "string.base": INVALID, "any.only": INVALID }),
});

const paging = {
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": INVALID,
    "number.integer": INVALID,
    "number.min": INVALID,
    "number.unsafe": INVALID,
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": INVALID,
    "number.integer": INVALID,
    "number.min": INVALID,
    "number.max": INVALID,
    "number.unsafe": INVALID,
  }),
  search: Joi.string().trim().max(150).allow("").default("").messages({ "string.base": INVALID, "string.max": INVALID }),
};
// GET /approval-groups?search=&status=&page=&limit=
const listGroupsSchema = Joi.object({
  ...paging,
  status: Joi.string().valid("ACTIVE", "INACTIVE").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});
// GET /approval-groups/approver-options?search=&projectId=
const approverOptionsSchema = Joi.object({ ...paging, projectId: Joi.string().trim().allow("").default("") });

module.exports = { createGroupSchema, updateGroupSchema, membersSchema, statusSchema, listGroupsSchema, approverOptionsSchema };

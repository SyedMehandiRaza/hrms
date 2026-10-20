const { EmployeeDraft, User } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { UUID, orNull } = require("./department.service");

// Employee drafts (docs/plans/workforce-and-lifecycle.md D53): a half-filled Add Employee wizard,
// shared by everyone in the company with employee:create. No expiry; deleted on create (13a).
const TOTAL_STEPS = 5;
const SAVED_BY = { model: User, as: "updatedBy", attributes: ["id", "name"], required: false };

const toItem = (draft, { withData = true } = {}) => ({
  id: draft.id,
  full_name: draft.full_name ?? null,
  email: draft.email ?? null,
  current_step: draft.current_step,
  total_steps: TOTAL_STEPS,
  ...(withData ? { data: draft.data } : {}),
  last_saved_at: draft.updatedAt,
  saved_by: draft.updatedBy ? { id: draft.updatedBy.id, name: draft.updatedBy.name } : null,
});

// The caller's draft, or 404 (also for a malformed id).
const findDraft = async (employerId, id) => {
  const draft = UUID.test(String(id)) ? await EmployeeDraft.findOne({ where: { id, employer_id: employerId }, include: [SAVED_BY] }) : null;
  if (!draft) throw new ErrorHandler("NOT_FOUND");
  return draft;
};

const columns = (userId, b) => ({
  current_step: b.step,
  full_name: orNull(b.fullName ?? null)?.slice(0, 255) ?? null,
  email: orNull(b.email ?? null)?.slice(0, 255) ?? null,
  data: b.data,
  updated_by: userId,
});

// GET /employee-drafts?page=&limit=, newest saved first. The list leaves out the data.
const listDrafts = async ({ employerId }, { page, limit }) => {
  const where = { employer_id: employerId };
  const total = await EmployeeDraft.count({ where });
  const rows = await EmployeeDraft.findAll({
    where,
    attributes: { exclude: ["data"] },
    include: [SAVED_BY],
    order: [
      ["updated_at", "DESC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map((d) => toItem(d, { withData: false })), total, page, limit };
};

const getDraft = async ({ employerId }, id) => toItem(await findDraft(employerId, id));

const createDraft = async ({ employerId, userId }, body) => {
  const draft = await EmployeeDraft.create({ employer_id: employerId, created_by: userId, ...columns(userId, body) });
  return getDraft({ employerId }, draft.id);
};

const updateDraft = async ({ employerId, userId }, id, body) => {
  const draft = await findDraft(employerId, id);
  draft.set(columns(userId, body));
  draft.changed("updated_at", true);
  await draft.save();
  return getDraft({ employerId }, draft.id);
};

const deleteDraft = async ({ employerId }, id) => {
  const draft = await findDraft(employerId, id);
  await draft.destroy();
  return { id: draft.id };
};

module.exports = { listDrafts, getDraft, createDraft, updateDraft, deleteDraft, TOTAL_STEPS };

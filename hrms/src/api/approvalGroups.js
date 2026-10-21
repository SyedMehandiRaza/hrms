import client from "./client";

// Approval group endpoints (backend/src/routes/approvalGroup.routes.js, workforce D17–D22,
// ADR 0011). Each returns the response's `data`. Errors are axios errors: read them with
// utils/apiError.js / utils/applyFieldErrors.js.
//
// A group: { id, name, code, module ("ALL"), description, scope ("GLOBAL"|"PROJECT"),
//   project: { id, name, code } | null, total_levels, approver_count, status ("ACTIVE"|"INACTIVE"),
//   levels_without_active_approver: [n], created_at, updated_at }
//   (+ members: [{ id, employee_id, name, employee_code, employment_status, level, is_mandatory,
//   can_skip }] on GET /:id)

// GET /approval-groups?page=&limit=&search=&status= → { items, total, page, limit } (newest first)
export const listApprovalGroups = ({ page = 1, limit = 100, search = "", status = "" } = {}) =>
  client.get("/approval-groups", { params: { page, limit, search, status } }).then((res) => res.data.data);

// GET /approval-groups/:id → the group with its members.
export const getApprovalGroup = (id) => client.get(`/approval-groups/${encodeURIComponent(id)}`).then((res) => res.data.data);

// GET /approval-groups/approver-options?search=&projectId=&limit= → { items: [{ id, name,
//   employee_code, employment_status, on_project }], total, page, limit }
export const listApproverOptions = ({ search = "", projectId = "", limit = 100 } = {}) =>
  client.get("/approval-groups/approver-options", { params: { search, projectId, limit } }).then((res) => res.data.data);

// POST /approval-groups { name, code, description?, scope, projectId?, moduleKey: "ALL",
//   members: [{ employeeId, level, isMandatory, canSkip }] } → the group.
// 409 APPROVAL_GROUP_NAME_TAKEN, APPROVAL_GROUP_CODE_TAKEN.
export const createApprovalGroup = (body) => client.post("/approval-groups", body).then((res) => res.data.data);

// PUT /approval-groups/:id (details only) → the group.
export const updateApprovalGroup = (id, body) =>
  client.put(`/approval-groups/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// PUT /approval-groups/:id/members { members } → the group. 409 APPROVAL_GROUP_HAS_PENDING.
export const updateApprovalGroupMembers = (id, members) =>
  client.put(`/approval-groups/${encodeURIComponent(id)}/members`, { members }).then((res) => res.data.data);

// PATCH /approval-groups/:id/status { status } → the group. 409 APPROVAL_GROUP_IN_USE (deactivate).
export const setApprovalGroupStatus = (id, status) =>
  client.patch(`/approval-groups/${encodeURIComponent(id)}/status`, { status }).then((res) => res.data.data);

// Shared by the group forms: API member rows ↔ form rows, and the module (only "All requests").
export const MODULE_ALL = "ALL";
export const toMemberBody = (rows) =>
  rows.map((r) => ({ employeeId: String(r.employee_id), level: Number(r.level_no), isMandatory: !!r.is_mandatory, canSkip: !!r.can_skip }));

import client from "./client";

// Leave type endpoints (backend/src/routes/leaveType.routes.js, workforce D30–D32): a leave type
// and its one policy are edited together. Each returns the response's `data`. Errors are axios
// errors: read them with utils/apiError.js / utils/applyFieldErrors.js.
//
// An item: { id, name, code, description, is_paid, allow_half_day, requires_document, is_active,
//   policy_id, yearly_quota, accrual_method, monthly_accrual, effective_from, effective_to,
//   allow_carry_forward, max_carry_forward_days, carry_forward_expiry_months, allow_encashment,
//   max_encashment_days, year_end_excess, allow_negative_balance, prorate_joiners,
//   assigned_employees, created_at, updated_at }

// GET /leave-types?page=&limit=&search=&status= (ACTIVE | INACTIVE | "" = all), by name →
//   { items, total, page, limit }
export const listLeaveTypes = ({ page = 1, limit = 10, search = "", status = "" } = {}) =>
  client.get("/leave-types", { params: { page, limit, search, status } }).then((res) => res.data.data);

// POST /leave-types (the whole form) → the item. 409 LEAVE_TYPE_NAME_TAKEN, LEAVE_TYPE_CODE_TAKEN.
export const createLeaveType = (body) => client.post("/leave-types", body).then((res) => res.data.data);

// PUT /leave-types/:id (the whole form) → the item.
export const updateLeaveType = (id, body) =>
  client.put(`/leave-types/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// DELETE /leave-types/:id → { id }. 409 LEAVE_TYPE_IN_USE once it was ever assigned.
export const removeLeaveType = (id) => client.delete(`/leave-types/${encodeURIComponent(id)}`).then((res) => res.data.data);

// POST /leave-types/:id/versions — not available yet (D30): always answers with an error message.
export const createLeaveTypeVersion = (id) =>
  client.post(`/leave-types/${encodeURIComponent(id)}/versions`, {}).then((res) => res.data.data);

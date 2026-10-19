import client from "./client";

// Department endpoints (backend/src/routes/department.routes.js, D31).
// Each returns the response's `data`. Errors are axios errors: read them with
// utils/apiError.js / utils/applyFieldErrors.js.
//
// A department item: { id, name, code, description, status ("ACTIVE"|"INACTIVE"),
//   dept_head_id, head_name, designation_count, created_at, updated_at }

// GET /departments?page=&limit=&search=&status= ("" = no filter), newest first →
//   { items, total, page, limit, stats: { total, active, inactive, designations } }
export const listDepartments = ({ page = 1, limit = 10, search = "", status = "" } = {}) =>
  client
    .get("/departments", { params: { page, limit, search, status } })
    .then((res) => res.data.data);

// GET /departments/:id → the item plus total_employees. NOT_FOUND (404) for an
// unknown or another company's id.
export const getDepartment = (id) =>
  client.get(`/departments/${encodeURIComponent(id)}`).then((res) => res.data.data);

// POST /departments → the new item (as getDepartment).
// Body: { name, code, description?, deptHeadId?, status? }. 409 DEPARTMENT_NAME_TAKEN /
// DEPARTMENT_CODE_TAKEN.
export const createDepartment = (body) => client.post("/departments", body).then((res) => res.data.data);

// PUT /departments/:id → the item. name and code always; omitted optional fields
// keep their values ("" or null clears description / deptHeadId).
export const updateDepartment = (id, body) =>
  client.put(`/departments/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// DELETE /departments/:id → { id }. 409 DEPARTMENT_IN_USE while employees use it.
export const removeDepartment = (id) =>
  client.delete(`/departments/${encodeURIComponent(id)}`).then((res) => res.data.data);

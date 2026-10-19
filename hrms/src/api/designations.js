import client from "./client";

// Designation endpoints (backend/src/routes/designation.routes.js, D32).
// Each returns the response's `data`. Errors are axios errors: read them with
// utils/apiError.js / utils/applyFieldErrors.js.
//
// A designation item: { id, department_id, name, code, description,
//   status ("ACTIVE"|"INACTIVE"), employee_count, created_at, updated_at }

// GET /departments/:id/designations?page=&limit=&search=&status= ("" = no filter),
// newest first → { items, total, page, limit }. NOT_FOUND for an unknown department.
export const listByDepartment = (departmentId, { page = 1, limit = 10, search = "", status = "" } = {}) =>
  client
    .get(`/departments/${encodeURIComponent(departmentId)}/designations`, {
      params: { page, limit, search, status },
    })
    .then((res) => res.data.data);

// POST /departments/:id/designations → the new item.
// Body: { name, code?, description?, status? }. 409 DESIGNATION_NAME_TAKEN (same
// department) / DESIGNATION_CODE_TAKEN (company-wide).
export const createDesignation = (departmentId, body) =>
  client
    .post(`/departments/${encodeURIComponent(departmentId)}/designations`, body)
    .then((res) => res.data.data);

// PUT /designations/:id → the item. name always; omitted optional fields keep their
// values; code "" or null clears it.
export const updateDesignation = (id, body) =>
  client.put(`/designations/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// DELETE /designations/:id → { id }. 409 DESIGNATION_IN_USE while employees hold it.
export const removeDesignation = (id) =>
  client.delete(`/designations/${encodeURIComponent(id)}`).then((res) => res.data.data);

// GET /designations?departmentId= ("" = every department) → { items: [{ id, name, code,
// department_id }] }: ACTIVE designations of ACTIVE departments, by name (dropdowns).
export const designationDropdown = (departmentId = "") =>
  client.get("/designations", { params: { departmentId } }).then((res) => res.data.data);

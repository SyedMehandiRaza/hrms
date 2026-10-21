import client from "./client";

// Salary component endpoints (backend/src/routes/salaryComponent.routes.js, workforce D41–D43).
// Each returns the response's `data`. Errors are axios errors: read them with utils/apiError.js.
//
// An item: { id, name, code, type ("EARNING"|"DEDUCTION"), description, is_default, is_system,
//   status ("ACTIVE"|"INACTIVE"), used_on_salaries, created_at, updated_at }

// GET /salary-components?page=&limit=&search=&type=&status= → { items, total, page, limit }
export const listSalaryComponents = ({ page = 1, limit = 10, search = "", type = "", status = "" } = {}) =>
  client.get("/salary-components", { params: { page, limit, search, type, status } }).then((res) => res.data.data);

// POST /salary-components { name, type, description? } → the item. 409 SALARY_COMPONENT_NAME_TAKEN.
export const createSalaryComponent = (body) => client.post("/salary-components", body).then((res) => res.data.data);

// PUT /salary-components/:id { name, type, description?, status? } → the item.
// 409 SALARY_COMPONENT_TYPE_LOCKED (type change once used), 403 SALARY_COMPONENT_SYSTEM.
export const updateSalaryComponent = (id, body) =>
  client.put(`/salary-components/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// DELETE /salary-components/:id → the item, now INACTIVE ("delete" = deactivate, D43).
export const deactivateSalaryComponent = (id) =>
  client.delete(`/salary-components/${encodeURIComponent(id)}`).then((res) => res.data.data);

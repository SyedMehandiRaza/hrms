import client from "./client";

// Employee endpoints (backend/src/routes/employee.routes.js, workforce D44–D57) and the
// wizard's lookups and drafts. Each returns the response's `data`. Errors are axios errors:
// read them with utils/apiError.js / utils/applyFieldErrors.js.

// GET /employees/check-unique?country_emp_id=&email=&phone=&phoneCountry= →
//   { field: { available } | { available: false, code, message } } for each field given (D46).
export const checkEmployeeUnique = (query) =>
  client.get("/employees/check-unique", { params: query }).then((res) => res.data.data);

// POST /employees (the wizard's body, workforce 13a/13b) → the created employee.
export const createEmployee = (body) => client.post("/employees", body).then((res) => res.data.data);

// GET /employees?page=&limit=&search=&status=&employmentType=&projectId=&roleId= (D56), by Employee ID →
//   { items: [{ id, employee_code, country_emp_id, name, email, employment_status, account_status,
//   access_level, role: { id, name } | null, employment_type, main_project: { id, name, code } | null,
//   staffing_company: { id, name } | null }], total, page, limit }
export const listEmployees = ({ page = 1, limit = 10, search = "", status = "", employmentType = "", projectId = "", roleId = "" } = {}) =>
  client
    .get("/employees", { params: { page, limit, search, status, employmentType, projectId, roleId } })
    .then((res) => res.data.data);

// GET /employees/:id → { overview, projects: { current, past, history }, shift, leave_policies, salary, approval_group }
export const getEmployee = (id) => client.get(`/employees/${encodeURIComponent(id)}`).then((res) => res.data.data);

// PUT /employees/:id (the create body without salary / projects) → the detail. 409 EMPLOYEE_EXITED.
export const updateEmployee = (id, body) => client.put(`/employees/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// PUT /employees/:id/main-project { projectId, effectiveFrom? } → the detail (D55).
export const changeMainProject = (id, body) =>
  client.put(`/employees/${encodeURIComponent(id)}/main-project`, body).then((res) => res.data.data);

// POST /employees/bulk-status { employeeIds, status: ACTIVE | SUSPENDED } → { updated } (all or nothing).
// 409 EMPLOYEE_EXITED, 403 ACCOUNT_OWNER_PROTECTED.
export const bulkEmployeeStatus = (employeeIds, status) =>
  client.post("/employees/bulk-status", { employeeIds, status }).then((res) => res.data.data);

// POST /employees/:id/resend-login → { temporary_password }. 409 EMPLOYEE_EXITED.
export const resendEmployeeLogin = (id) =>
  client.post(`/employees/${encodeURIComponent(id)}/resend-login`, {}).then((res) => res.data.data);

// GET /roles → [{ id, name }] (D48).
export const listRoles = () => client.get("/roles").then((res) => res.data.data);

// GET /staffing-companies?status=ACTIVE → [{ id, name, code }] (D48).
export const listStaffingCompanies = (status = "ACTIVE") =>
  client.get("/staffing-companies", { params: { status } }).then((res) => res.data.data);

// ── Drafts (D53): a half-filled wizard, shared within the company ──
// A draft: { id, full_name, email, current_step, total_steps, data, last_saved_at, saved_by: { id, name } }

// GET /employee-drafts?page=&limit= → { items (without data), total, page, limit }, newest first.
export const listEmployeeDrafts = ({ page = 1, limit = 10 } = {}) =>
  client.get("/employee-drafts", { params: { page, limit } }).then((res) => res.data.data);

// GET /employee-drafts/:id → the draft with its data.
export const getEmployeeDraft = (id) => client.get(`/employee-drafts/${encodeURIComponent(id)}`).then((res) => res.data.data);

// POST /employee-drafts { step, fullName?, email?, data } → the draft. Data over 1 MB → 400 on `data`.
export const createEmployeeDraft = (body) => client.post("/employee-drafts", body).then((res) => res.data.data);

// PUT /employee-drafts/:id (same body) → the draft.
export const updateEmployeeDraft = (id, body) =>
  client.put(`/employee-drafts/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// DELETE /employee-drafts/:id → { id }.
export const removeEmployeeDraft = (id) =>
  client.delete(`/employee-drafts/${encodeURIComponent(id)}`).then((res) => res.data.data);

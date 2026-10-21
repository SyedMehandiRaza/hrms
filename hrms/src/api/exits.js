import client from "./client";

// Exit endpoints (backend/src/routes/exit.routes.js, workforce D58–D68). Each returns the
// response's `data`. Errors are axios errors: read them with utils/apiError.js /
// utils/applyFieldErrors.js.
//
// A list item: { id, employee: { id, name, employee_code }, exit_type, reason_category, status
//   (PENDING_APPROVAL | IN_NOTICE | EXITED | COMPLETED | CANCELLED | REJECTED), notice_start_date,
//   notice_days, last_working_day, reject_reason, cancel_reason, created_at }
// The detail adds: reason, preferred_last_day, original_last_working_day, allow_leave_during_notice,
//   encash_leave, loan_handling, rehire_eligible, cooling_period_days, rehire_allowed_from,
//   approval_request_id, raised_by: { id, name }, events: [{ id, event_type, payload, actor_user_id,
//   created_at }], lwd_history: [{ from, to, actor_user_id, created_at }]

// GET /exits?page=&limit=&search=&status=&type=&reason=&lwdMonth= → { items, total, page, limit,
//   counts: { [status]: n } }. `status` is one status or a comma-separated list; counts follow every
//   filter but the status.
export const listExits = ({ page = 1, limit = 10, search = "", status = "", type = "", reason = "", lwdMonth = "" } = {}) =>
  client.get("/exits", { params: { page, limit, search, status, type, reason, lwdMonth } }).then((res) => res.data.data);

// GET /exits/:id → the detail.
export const getExit = (id) => client.get(`/exits/${encodeURIComponent(id)}`).then((res) => res.data.data);

// GET /employees/:id/exit-preview (id may be "me") → { defaults: { noticeStartDate, noticeDays,
//   coolingPeriodDays, allowLeaveDuringNotice, encashLeave }, warnings: { approval_groups: [{ id, name }],
//   pending_approvals, departments_headed: [{ id, name }], projects: [{ id, name, code }] } } (D62, D65).
export const getExitPreview = (employeeId) =>
  client.get(`/employees/${encodeURIComponent(employeeId)}/exit-preview`).then((res) => res.data.data);

// POST /employees/:id/exits { exitType, reasonCategory, reason, noticeStartDate, noticeDays,
//   lastWorkingDay, preferredLastDay?, allowLeaveDuringNotice, encashLeave, rehireEligible,
//   coolingPeriodDays? } → the exit (PENDING_APPROVAL). 409 EXIT_ALREADY_OPEN.
export const raiseExit = (employeeId, body) =>
  client.post(`/employees/${encodeURIComponent(employeeId)}/exits`, body).then((res) => res.data.data);

// GET /exit-settings → { noticeDays, coolingPeriodDays, allowLeaveDuringNotice, encashLeave,
//   blockLoansDuringNotice }
export const getExitSettings = () => client.get("/exit-settings").then((res) => res.data.data);

// PUT /exit-settings (the same five fields) → the saved settings.
export const saveExitSettings = (body) => client.put("/exit-settings", body).then((res) => res.data.data);

// ── Exit actions (D59, D64, D65, D67); each → the exit detail (rehire → the employee) ──

// POST /exits/:id/withdraw { reason } (5–500): a pending exit → CANCELLED.
export const withdrawExit = (id, reason) =>
  client.post(`/exits/${encodeURIComponent(id)}/withdraw`, { reason }).then((res) => res.data.data);

// PUT /exits/:id/terms { reasonCategory?, reason?, noticeDays?, lastWorkingDay?, preferredLastDay?,
//   allowLeaveDuringNotice?, encashLeave?, rehireEligible?, loanHandling?, coolingPeriodDays? }
//   (only the changed ones; the exit type and notice start stay).
export const editExitTerms = (id, body) =>
  client.put(`/exits/${encodeURIComponent(id)}/terms`, body).then((res) => res.data.data);

// POST /exits/:id/cancel { reason } (5–500): an exit in notice → CANCELLED, the employee Active again.
export const cancelExit = (id, reason) =>
  client.post(`/exits/${encodeURIComponent(id)}/cancel`, { reason }).then((res) => res.data.data);

// POST /exits/:id/confirm-immediate { reason } (10–500, owner only): LWD = today, processed now.
export const confirmExitImmediate = (id, reason) =>
  client.post(`/exits/${encodeURIComponent(id)}/confirm-immediate`, { reason }).then((res) => res.data.data);

// POST /exits/:id/rehire { rehireDate?, mainProjectId?, … } → the rehired employee.
// 409 REHIRE_NOT_ALLOWED (cooling period), REHIRE_NOT_ELIGIBLE.
export const rehireExit = (id, body) =>
  client.post(`/exits/${encodeURIComponent(id)}/rehire`, body).then((res) => res.data.data);

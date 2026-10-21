import client from "./client";

// Approval requests (backend/src/routes/approval.routes.js, workforce D18, D23–D29). Each returns
// the response's `data`. Errors are axios errors: read them with utils/apiError.js.
//
// An inbox row: { id, request_code, entity_type, entity_id, type (label, e.g. "Exit"),
//   employee: { id, name, employee_code } | null, requested_at, current_level, total_levels,
//   owner_only, blocked }

// GET /approvals/inbox → { items, total }: requests waiting at the caller's level; the owner also
// sees owner-only and blocked requests.
export const getInbox = () => client.get("/approvals/inbox").then((res) => res.data.data);

// POST /approvals/:id/approve { comment? , reason? } — the owner deciding on someone's behalf
// (owner-only or blocked request) gives a reason (5–500).
// 403 APPROVAL_NOT_YOUR_TURN, 409 APPROVAL_ALREADY_DECIDED.
export const approveRequest = (id, body = {}) =>
  client.post(`/approvals/${encodeURIComponent(id)}/approve`, body).then((res) => res.data.data);

// POST /approvals/:id/reject { reason } (5–500).
export const rejectRequest = (id, reason) =>
  client.post(`/approvals/${encodeURIComponent(id)}/reject`, { reason }).then((res) => res.data.data);

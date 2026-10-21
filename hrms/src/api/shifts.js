import client from "./client";

// Shift endpoints (backend/src/routes/shift.routes.js, workforce D35–D39). Each returns the
// response's `data`. Errors are axios errors: read them with utils/apiError.js.
//
// A shift item: { id, name, start_time "HH:mm", end_time "HH:mm", is_overnight,
//   scheduled: [timing], created_at, updated_at } (+ history: [timing], newest first, on GET /:id)
// A timing: { effective_from, start_time, end_time, is_overnight, state: "IN_FORCE"|"SCHEDULED"|"PAST" }

// GET /shifts?page=&limit=&search= (by name) → { items, total, page, limit }
export const listShifts = ({ page = 1, limit = 10, search = "" } = {}) =>
  client.get("/shifts", { params: { page, limit, search } }).then((res) => res.data.data);

// GET /shifts/:id → the item with its timing history.
export const getShift = (id) => client.get(`/shifts/${encodeURIComponent(id)}`).then((res) => res.data.data);

// POST /shifts { name, start_time, end_time } → the item. 409 SHIFT_NAME_TAKEN.
export const createShift = (body) => client.post("/shifts", body).then((res) => res.data.data);

// PUT /shifts/:id { name, start_time, end_time, effective_from? } → the item. New times apply from
// effective_from (default today).
export const updateShift = (id, body) => client.put(`/shifts/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// DELETE /shifts/:id → { id }. 409 SHIFT_IN_USE.
export const removeShift = (id) => client.delete(`/shifts/${encodeURIComponent(id)}`).then((res) => res.data.data);

// GET /shifts/week-offs/years → { today, current_id, years: [{ id, label, start_date, end_date,
//   status, year_locked, locked_months: ["YYYY-MM"] }] } (oldest first)
export const listWeekOffYears = () => client.get("/shifts/week-offs/years").then((res) => res.data.data);

// GET /shifts/:id/week-offs?financialYearId= → { financial_year, dates, today, year_locked, locked_months }
export const getWeekOffs = (id, financialYearId) =>
  client.get(`/shifts/${encodeURIComponent(id)}/week-offs`, { params: { financialYearId } }).then((res) => res.data.data);

// PUT /shifts/:id/week-offs { financialYearId, dates } → as GET. 409 SHIFT_WEEKOFF_LOCKED.
export const saveWeekOffs = (id, financialYearId, dates) =>
  client.put(`/shifts/${encodeURIComponent(id)}/week-offs`, { financialYearId, dates }).then((res) => res.data.data);

// GET /shifts/week-offs/copy-preview?to_fy= → { from_fy, to_fy, shifts: [{ shift_id, name, weekdays, dates_to_add }] }
// 409 SHIFT_WEEKOFF_NO_NEXT_FY.
export const weekOffCopyPreview = (toFy) =>
  client.get("/shifts/week-offs/copy-preview", { params: { to_fy: toFy || "" } }).then((res) => res.data.data);

// POST /shifts/week-offs/copy { to_fy, shift_ids } → { to_fy, added: { shiftId: count } }
export const copyWeekOffs = (toFy, shiftIds) =>
  client.post("/shifts/week-offs/copy", { to_fy: toFy || "", shift_ids: shiftIds }).then((res) => res.data.data);

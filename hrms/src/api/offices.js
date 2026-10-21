import client from "./client";

// Head office endpoints (backend/src/routes/office.routes.js, workforce D1–D6, ADR 0010).
// Each returns the response's `data`. Errors are axios errors: read them with
// utils/apiError.js / utils/applyFieldErrors.js.
//
// An office item: { id, name, email, phone (E.164), phone_country (ISO-2), location, latitude,
//   longitude, image ("/uploads/..." or null — use assetUrl), country: { id, iso2, name },
//   city: { id, name } | null, status ("ACTIVE"|"UNASSIGNED"), project: { id, name, code, status } | null,
//   employee_count, contract_employee_count, created_at, updated_at }

// GET /offices?page=&limit=&search=&status= ("" = no filter), newest first →
//   { items, total, page, limit, stats: { total_offices, active_offices, total_locations, total_projects } }
export const listOffices = ({ page = 1, limit = 10, search = "", status = "" } = {}) =>
  client.get("/offices", { params: { page, limit, search, status } }).then((res) => res.data.data);

// GET /offices/:id → the item. NOT_FOUND (404) for an unknown or another company's id.
export const getOffice = (id) => client.get(`/offices/${encodeURIComponent(id)}`).then((res) => res.data.data);

// POST /offices → the new item.
// Body: { name, email, phone, phoneCountry, location, countryId, cityId?, latitude?, longitude? }.
// 409 OFFICE_NAME_TAKEN.
export const createOffice = (body) => client.post("/offices", body).then((res) => res.data.data);

// PUT /offices/:id → the item. Same body as create; null/"" clears cityId.
export const updateOffice = (id, body) =>
  client.put(`/offices/${encodeURIComponent(id)}`, body).then((res) => res.data.data);

// DELETE /offices/:id → { id }. 409 OFFICE_IN_USE while it has a project.
export const removeOffice = (id) => client.delete(`/offices/${encodeURIComponent(id)}`).then((res) => res.data.data);

// PUT /offices/:id/image, multipart field `image` (JPG/PNG ≤ 2 MB) → the item.
// 400 OFFICE_IMAGE_INVALID.
export const uploadOfficeImage = (id, file) => {
  const form = new FormData();
  form.append("image", file);
  return client.put(`/offices/${encodeURIComponent(id)}/image`, form).then((res) => res.data.data);
};

// DELETE /offices/:id/image → the item (image null).
export const removeOfficeImage = (id) =>
  client.delete(`/offices/${encodeURIComponent(id)}/image`).then((res) => res.data.data);

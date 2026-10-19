import client from "./client";

// Company endpoints (backend/src/routes/company.routes.js, industryType.routes.js).
// Each returns the response's `data`. Errors are axios errors: read them with
// utils/apiError.js / utils/applyFieldErrors.js.

// GET /company (any login) → { id, company_name, industry_type_id, industry_name, company_email,
//   company_phone_number, address, company_logo ("/uploads/..." or null — use assetUrl), created_at,
//   timezone, currency }
export const getCompany = () => client.get("/company").then((res) => res.data.data);

// PUT /company (owner only) → the company (as getCompany).
// Body: { companyName, industryTypeId, email, phone, address } — every field required.
export const updateCompany = ({ companyName, industryTypeId, email, phone, address }) =>
  client
    .put("/company", { companyName, industryTypeId, email, phone, address })
    .then((res) => res.data.data);

// PUT /company/logo (owner only), multipart field `logo` (JPG/PNG ≤ 2 MB) → the company.
export const uploadLogo = (file) => {
  const form = new FormData();
  form.append("logo", file);
  return client.put("/company/logo", form).then((res) => res.data.data);
};

// DELETE /company/logo (owner only) → the company (company_logo null).
export const removeLogo = () => client.delete("/company/logo").then((res) => res.data.data);

// GET /industry-types (any login) → [{ id, name }] by name.
export const getIndustryTypes = () => client.get("/industry-types").then((res) => res.data.data);

// GET /company/time-settings (ADMIN or financial_year:read) → { timezone, fy_start_month,
//   review_days_before, auto_open_next_year, reopen_window_days, lock_mode, pending_on_close,
//   offline_backdate_days, fy_start_month_locked }
export const getTimeSettings = () => client.get("/company/time-settings").then((res) => res.data.data);

// PATCH /company/time-settings (ADMIN or financial_year:update) → as getTimeSettings.
// Only { timezone?, fy_start_month? } are read; COMPANY_FY_START_LOCKED (409) when the
// start month changes after a year was closed.
export const updateTimeSettings = (body) =>
  client.patch("/company/time-settings", body).then((res) => res.data.data);

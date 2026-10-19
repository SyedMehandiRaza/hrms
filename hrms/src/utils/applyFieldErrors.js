// Map a backend validation error onto react-hook-form inputs, so the server's
// message appears UNDER the input it belongs to (the same place the client
// rules show theirs).
//
// The backend answers 400 with { success: false, code: "VALIDATION_FAILED",
// message, errors: { field: message } } — messages already in the user's
// language (docs/standards.md §2). The older array shape
// errors: [{ field, message }] is still read. `field` is the input path
// ("reason", "items.2.label").
//
//   const res = applyFieldErrors(err, setError, { fieldMap, knownFields });
//   res.mapped   → form fields that received a message (first one is focused)
//   res.unmapped → messages with no matching input (show them in a toast)
//
// fieldMap    : { backendField: "formField" } for renamed inputs
// knownFields : optional whitelist (exact names or prefixes like "items.");
//               anything else lands in `unmapped`.

import i18n from "../i18n";

// [{ field, message }] from either the map or the legacy array shape.
export const serverErrors = (err) => {
  const errors = err?.response?.data?.errors;
  if (Array.isArray(errors)) return errors.filter((r) => r && r.field && r.message);
  if (errors && typeof errors === "object") {
    return Object.entries(errors)
      .filter(([field, message]) => field && typeof message === "string" && message)
      .map(([field, message]) => ({ field, message }));
  }
  return [];
};

// The server's localized `message` (shown exactly as returned). No message
// (network error, server down, CORS) → `fallback`, else the catalog's
// INTERNAL_ERROR text "Something went wrong. Please try again." (common:ui.genericError).
export const serverMessage = (err, fallback) =>
  err?.response?.data?.message || fallback || i18n.t("common:ui.genericError");

export const applyFieldErrors = (err, setError, { fieldMap = {}, knownFields } = {}) => {
  const out = { mapped: [], unmapped: [] };
  const rows = serverErrors(err);
  rows.forEach(({ field, message }) => {
    const name = fieldMap[field] || field;
    const known =
      !knownFields || knownFields.some((k) => (k.endsWith(".") ? name.startsWith(k) : name === k));
    if (known) {
      setError(name, { type: "server", message }, { shouldFocus: out.mapped.length === 0 });
      out.mapped.push(name);
    } else {
      out.unmapped.push(message);
    }
  });
  return out;
};

export default applyFieldErrors;

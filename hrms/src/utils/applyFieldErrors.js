// Map a backend validation error onto react-hook-form inputs, so the server's
// message appears UNDER the input it belongs to (the same place the client
// rules show theirs).
//
// The backend answers 400 with { message, errName: "ValidationError",
// errors: [{ field, message }] } — messages already in the user's language.
// `field` is the input path ("reason", "items.2.label").
//
//   const res = applyFieldErrors(err, setError, { fieldMap, knownFields });
//   res.mapped   → form fields that received a message (first one is focused)
//   res.unmapped → messages with no matching input (show them in a toast)
//
// fieldMap    : { backendField: "formField" } for renamed inputs
// knownFields : optional whitelist (exact names or prefixes like "items.");
//               anything else lands in `unmapped`.

export const serverErrors = (err) => {
  const rows = err?.response?.data?.errors;
  return Array.isArray(rows) ? rows.filter((r) => r && r.field && r.message) : [];
};

export const serverMessage = (err, fallback) =>
  err?.response?.data?.message || fallback || err?.message || "";

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

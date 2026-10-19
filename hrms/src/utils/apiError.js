import { toast } from "react-toastify";
import { serverErrors, serverMessage } from "./applyFieldErrors";

// Error helpers for axios errors from src/api/* — the API answers
// { success: false, code, message, errors? } (docs/standards.md §2).
//
//   apiErrorMessage(err)        → the server's localized message, or the generic
//                                 "Something went wrong. Please try again."
//   apiErrorCode(err)           → "DEPARTMENT_NAME_TAKEN" | undefined (network error)
//   toastApiError(err)          → one toast with that message
//   fieldErrorsOf(err, fields)  → { map: { field: message }, unmapped: [messages] }
//   (react-hook-form forms: applyFieldErrors in ./applyFieldErrors.js)
export const apiErrorMessage = (err, fallback) => serverMessage(err, fallback);

export const apiErrorCode = (err) => err?.response?.data?.code;

export const isPeriodClosedError = (error) =>
  error?.response?.data?.errName === "PeriodClosed";

// One toast for a failed action — never a second one for PeriodClosed.
//
//   catch (err) { toastApiError(err, t("…failed")); }
export const toastApiError = (err, fallback) => {
  if (isPeriodClosedError(err)) {
    const [first] = serverErrors(err);
    if (first) toast.error(first.message, { toastId: "period-closed" });
    return;
  }
  toast.error(serverMessage(err, fallback));
};

// Map field errors into a { field: message } object (forms that keep errors in
// local state instead of react-hook-form). Returns the leftovers' messages (no
// matching field) so the caller can toast them.
export const fieldErrorsOf = (err, knownFields) => {
  const map = {};
  const unmapped = [];
  serverErrors(err).forEach(({ field, message }) => {
    if (!knownFields || knownFields.some((k) => (k.endsWith(".") ? field.startsWith(k) : field === k))) {
      if (!map[field]) map[field] = message;
    } else {
      unmapped.push(message);
    }
  });
  return { map, unmapped };
};

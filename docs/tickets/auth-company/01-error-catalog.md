# 01: Error catalog and response shape

**What to build:** Every failed API call answers in one shape, `{ success: false, code, message, errors? }`,
with `message` in the caller's language (`Accept-Language: ar` → Arabic, anything else → English). Validation
failures list every bad field at once. Codes and texts come from `docs/standards.md` §7; behaviour from §2
and ADR 0004.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every code in standards §7.1 exists in the backend catalog with its HTTP status, English text exactly as
      in §7.1, and Arabic text (reused from the UI's Arabic files where one exists; otherwise drafted and marked
      for native review). A test walks the whole catalog.
- [ ] A request with two invalid fields gets 400, `code: VALIDATION_FAILED`, message
      "Please fix the highlighted fields.", and an `errors` map containing both fields with their §7.2 messages.
- [ ] The same request with `Accept-Language: ar` gets the Arabic message and Arabic field messages.
- [ ] A body that isn't valid JSON gets 400 `INVALID_JSON` "Malformed JSON body".
- [ ] An unexpected server error gets 500 `INTERNAL_ERROR` "Something went wrong. Please try again." with no
      stack trace or internal detail in the body; the error is logged on the server.
- [ ] An unknown route gets 404 `NOT_FOUND` "The requested record was not found."
- [ ] The existing middleware and health tests are moved to the new codes and texts: same statuses, body
      assertions now check `code` and `message` (a spec change, not a weakened test).
- [ ] The backend rules doc describes the new shape (already updated in planning; verify it matches the code).

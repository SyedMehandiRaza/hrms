# 02: Contract Studio messages

**What to build:** Every Contract Studio code and field message from standards §7.3 in the backend catalog,
in English and Arabic (Arabic marked for native review).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] When any §7.3 code is raised → the response has that code, its HTTP status and the exact English message.
- [ ] When the same request is sent with `Accept-Language: ar` → the Arabic text is returned with the same code.
- [ ] When `CONTRACT_FIELD_MISSING` is raised for Designation and Project → "Some contract values are missing:
      Designation, Project."
- [ ] When `CONTRACT_ACTIVE_EXISTS` is raised for CON-2026-0007 → "This recipient already has an active contract of
      this type (CON-2026-0007). Revoke it or wait for it to finish."
- [ ] When a §7.3 field message is used → its text matches the UI's existing string exactly where one already exists.

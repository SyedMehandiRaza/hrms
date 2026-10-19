# 14: UI foundation: API client, session, route guards, permissions

**What to build:** Prefactor so every screen ticket after it is small. The UI talks to the real API, keeps the
access token in memory only, refreshes silently on expiry, sends the current language, and the existing stubs
for "who is logged in", route protection and permission checks become real (D3, D12, D13, D23, D34). No design
changes.

**Blocked by:** 04 Login, refresh, logout

**Status:** in-progress

- [x] Every API call sends the current UI language; switching to Arabic makes server messages Arabic.
- [x] When the access token expires, the next call refreshes once and retries without the user noticing; if
      refresh fails the user lands on the login screen.
- [x] A 403 with `AUTH_ACCOUNT_INACTIVE` or `AUTH_COMPANY_INACTIVE` sends the user to the Access ended screen; a
      403 with `AUTH_PASSWORD_CHANGE_REQUIRED` opens the forced change modal (ticket 20) once it exists.
- [x] Reloading any page keeps a logged-in user logged in.
- [x] Route protection: an employee or staffing user opening an admin URL is redirected to their own dashboard;
      a logged-out visitor is sent to login.
- [x] Permission checks used by the sidebar and buttons read the real permissions: the employee test user no
      longer sees admin-only items.
- [x] A shared pattern exists for screens: loading state, empty state, error state with the server `message`,
      and field errors shown under inputs from the `errors` map.
- [x] The Verify OTP route import uses the file's real casing (fixes Linux builds).
- [x] Lint passes for touched files.

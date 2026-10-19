# 23: Header logout and Access ended screen

**What to build:** Logout from the header profile menu ends the session in every panel, and the existing Access
ended screen explains why a user was signed out (§4 Logout, Access ended, D34).

**Blocked by:** 14 UI foundation

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] Logout from the admin, employee and staffing headers → login screen; the browser Back button doesn't show the
      dashboard again; reloading stays on login.
- [ ] Logout works even if the session had already ended on the server.
- [ ] Deactivating the logged-in user (in the test database) → their next action lands on Access ended with
      "Your account is inactive. Contact your administrator."
- [ ] Deactivating their company → Access ended with "Your company's access is disabled. Contact support."
- [ ] "Back to sign in" clears the local session and opens login.
- [ ] Lint passes.

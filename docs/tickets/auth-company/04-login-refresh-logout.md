# 04: Login, refresh, logout, current user and permission guard

**What to build:** A person logs in with email and password, stays logged in through silent refresh, logs out,
and every protected endpoint knows who they are, which company they act for and what their role allows
(D2, D3, D7–D9, D12–D14, D16, D20, D23, D26, D33, D34; ADR 0002). Lockout and rate limits are ticket 05;
temporary-password rules are ticket 08.

**Blocked by:** 01 Error catalog, 02 Schema changes

**Status:** done

- [x] Each of the four test users (`docs/test-users.md`) logs in and receives an access token in the body plus a
      refresh cookie (httpOnly, Strict, scoped to the auth paths, 7 days). Their "current user" response shows
      their name, company, panel and permissions: everything allowed for the owner, only the role's flags for
      the others.
- [x] A wrong password and an unknown email both get 401 `AUTH_INVALID_CREDENTIALS`
      "Invalid email or password." with identical bodies.
- [x] Missing email or password gets 400 `VALIDATION_FAILED` with "Email is required" / "Invalid email address" /
      "Password is required" under the matching field.
- [x] An inactive person, a person whose only account has ended, or a suspended account gets 403
      `AUTH_ACCOUNT_INACTIVE` "Your account is inactive. Contact your administrator."
- [x] A person whose company is inactive or banned gets 403 `AUTH_COMPANY_INACTIVE`
      "Your company's access is disabled. Contact support." A user already logged in gets the same 403 on their
      very next request after the company or account is deactivated.
- [x] Refresh issues a new access token and a new cookie; the old cookie stops working. Presenting an old,
      already-rotated cookie ends **every** session of that account and returns 401 `AUTH_REFRESH_INVALID`
      "Your session has expired. Please log in again."
- [x] Logout ends the current session and clears the cookie; a refresh afterwards gets 401. Logout without a
      cookie still returns 200.
- [x] No token or a garbage token gets 401 `AUTH_REQUIRED` "Please log in to continue."; an expired access token
      gets 401 `AUTH_TOKEN_EXPIRED` "Your session has expired. Please log in again."
- [x] An endpoint guarded by a module action refuses a role without that flag, and an account with no role, with
      403 `FORBIDDEN` "You don't have permission to do this."; the owner always passes.
- [x] Changing a role's flags affects that user's next request without logging in again.
- [x] Successful login records the last-login time; failed logins are written to the server log without the
      password.
- [x] The UI origin can call the API with credentials (CORS); the user is told to add the allowed-origin
      variable to the env example.

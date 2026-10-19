# 15: Login screen

**What to build:** The existing Login screen logs people in for real and sends them to their panel (§4 Login).

**Blocked by:** 14 UI foundation, 05 Lockout and rate limits

**Status:** in-progress

Verified by the ui-tester agent in a real browser:

- [ ] `admin@hrms.test` / `Test@12345` → Log In shows "Signing In..." with the button disabled, then lands on the
      admin dashboard with the company name in the header.
- [ ] `subadmin@`, `employee@` and `staffing@hrms.test` each land on their own panel's dashboard.
- [ ] Empty email → "Email is required" under the email field; `abc` → "Invalid email address"; empty password →
      "Password is required" under the password field. Nothing is sent.
- [ ] Wrong password → "Invalid email or password." shown as returned.
- [ ] Five wrong passwords → "Too many failed attempts. Try again in 15 minutes."
- [ ] A deactivated user → Access ended screen with "Your account is inactive. Contact your administrator."
- [ ] Too many attempts from one browser → "Too many requests. Please try again in a minute."
- [ ] Server unreachable → "Something went wrong. Please try again." and the button is enabled again.
- [ ] In Arabic, the server messages above appear in Arabic.
- [ ] Lint passes.

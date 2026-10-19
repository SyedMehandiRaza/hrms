# 21: Profile → Change password and session picker

**What to build:** The Profile screen's change-password form works in all three panels, and after a successful
change a new modal (approved, D15) lets the user choose which other sessions to end: **Select all checked by
default**, a checkbox per session, "End selected sessions" and "Keep all". Strings in English and Arabic.

**Blocked by:** 14 UI foundation, 09 Change password and sessions

**Status:** in-progress

Verified by the ui-tester agent with two browser contexts logged in as the same user:

- [ ] Changing the password in context A opens the picker listing context B (device, IP, last used) with Select all
      checked; "End selected sessions" → context B is sent to login on its next action; context A stays in.
- [ ] Unchecking B and choosing "Keep all" leaves context B logged in.
- [ ] With no other sessions, no picker appears; a success toast is shown.
- [ ] Wrong current password → "Your current password is incorrect." under that field.
- [ ] Field errors under the inputs: "Password is required", the password-rule message,
      "Please confirm your password", "Passwords do not match", "New password must be different from your current
      one."
- [ ] Five wrong current passwords → "Too many failed attempts. Try again in 15 minutes." and the user is logged out.
- [ ] Works from the admin, employee and staffing-company Profile screens.
- [ ] Lint passes.

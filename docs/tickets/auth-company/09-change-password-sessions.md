# 09: Change password and sessions

**What to build:** A logged-in person changes their password and sees and ends their sessions on other devices
(D10, D14, D15, D24). The API never ends sessions by itself on a change; the UI asks which ones to end.

**Blocked by:** 04 Login, refresh, logout

**Status:** ready-for-agent

- [ ] Correct current password + valid new password → 200; the new password logs in, the old one doesn't; the
      current session keeps working; any "must change password" state is cleared.
- [ ] Wrong current password → 400 `AUTH_CURRENT_PASSWORD_WRONG` "Your current password is incorrect."; the fifth
      wrong attempt in a row → 423 "Too many failed attempts. Try again in 15 minutes." and the current session
      ends.
- [ ] Weak password → the password-rule message; mismatch → "Passwords do not match"; same as current →
      "New password must be different from your current one."
- [ ] The sessions list shows only the caller's active sessions with device/browser, IP, started and last used,
      and marks the current one.
- [ ] Ending selected sessions makes their refresh cookies stop working; "end all" ends every session except the
      current one.
- [ ] Trying to end the current session → 400 `SESSION_REVOKE_CURRENT`
      "You can't end your current session here. Use Log out instead."
- [ ] Including another person's session → 404 "The requested record was not found." and nothing is ended.

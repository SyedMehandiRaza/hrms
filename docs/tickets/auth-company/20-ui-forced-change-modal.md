# 20: Forced change-password modal

**What to build:** New UI, approved in planning (D21, ADR 0003). After logging in with a temporary password, a
modal that can't be dismissed asks for the temporary password, a new password and confirmation. Built with the
existing modal and form styles. Strings in English and Arabic.

**Blocked by:** 15 Login screen, 08 Temporary password, setup link and forced change, 21 Profile → Change
password and session picker (reuses its picker)

**Status:** ready-for-agent

Verified by the ui-tester agent (temporary-password user from the seed or created in the test):

- [ ] Logging in with the temporary password opens the modal over the dashboard; the only other action is Log out.
- [ ] Navigating elsewhere or calling anything else keeps showing the modal (server answers
      "Please change your temporary password to continue.").
- [ ] Wrong temporary password → "Your current password is incorrect." under the current-password field.
- [ ] Field errors: "Password is required", the password-rule message, "Please confirm your password",
      "Passwords do not match", "New password must be different from your current one."
- [ ] Valid change → session picker if other sessions exist → dashboard usable.
- [ ] A temporary password older than 72 hours fails at login with "Your temporary password has expired. Ask your
      administrator to resend it."
- [ ] Lint passes.

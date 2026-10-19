# 08: Temporary password, setup link and forced change

**What to build:** The building block later modules call when an admin creates a login: the person gets a
welcome email with a temporary password and a setup link, and can't use the app until they replace the
temporary password (D9, D20, D21; ADRs 0002, 0003). Also the guard that stops an email from holding a current
account in two companies. The admin screens that create logins belong to later modules.

**Blocked by:** 03 Mailer, 04 Login, refresh, logout

**Status:** ready-for-agent

- [ ] Issuing credentials for a person with no password sends the temporary-password welcome email; logging in
      with that password succeeds and the response says the password must be changed.
- [ ] While the password must be changed, any other request (e.g. listing departments) → 403
      `AUTH_PASSWORD_CHANGE_REQUIRED` "Please change your temporary password to continue."; current user,
      change password and logout still work.
- [ ] Opening the setup link and setting a valid password logs the person in and clears the "must change" state;
      using the link again → 400 `AUTH_SETUP_LINK_INVALID`
      "This link is invalid or has expired. Ask your administrator to resend it."
- [ ] After 72 hours (time mocked), logging in with the temporary password → 403 `AUTH_SETUP_EXPIRED`
      "Your temporary password has expired. Ask your administrator to resend it."; the link gives the
      invalid-link message.
- [ ] Issuing again (Resend) makes the old temporary password and the old link both stop working.
- [ ] A person who already has a password (from another company) gets the existing-password email; their
      password is unchanged and they aren't forced to change it.
- [ ] The guard rejects an email with a current account in another company with 409
      `ACCOUNT_EMAIL_IN_OTHER_COMPANY` "This email is already used by another company.", and allows an email
      whose other accounts have all ended.
- [ ] Setting a password through the link follows the password rule and its messages.

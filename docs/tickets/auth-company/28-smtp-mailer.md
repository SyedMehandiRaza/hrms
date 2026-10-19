# 28: Real email delivery over SMTP

**What to build:** With `MAIL_DRIVER=smtp` and SMTP settings in the environment, the three Auth emails (welcome
with temporary password, welcome with existing password, reset code) are actually delivered. Console stays the
dev default and tests keep the in-memory outbox (D25, standards §6). User decision 2026-10-19.

**Blocked by:** 03 Mailer

**Status:** done

- [x] With `MAIL_DRIVER=smtp`, sending any of the three templates hands one message to the SMTP transport with the
      configured sender, the recipient, subject and body (EN or AR by the person's language).
- [x] SMTP settings come from the environment: host, port, secure flag, user, password. Missing host → a clear
      "SMTP mail driver is not configured" error at send time; nothing crashes at start-up.
- [x] A delivery failure on the forgot-password and welcome paths is logged on the server and never changes the
      API response (forgot-password still answers "If an account exists for this email, you'll receive a reset code.").
- [x] Passwords and SMTP credentials are never logged.
- [x] Tests run without a real SMTP server (transport stubbed); the console and memory drivers behave as before.
- [x] The user is told which variables to add to the env example; the agent doesn't read or edit env files.

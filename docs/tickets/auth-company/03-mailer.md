# 03: Mailer

**What to build:** The system can send the three emails Auth needs, in the person's language, printed to the
console in development and captured in an outbox in tests (D25, standards §6). Real SMTP comes later.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] **Welcome with temporary password** (EN/AR): contains the login email, the temporary password, a
      "Set your password" link built from the app URL, and says both expire in 72 hours.
- [x] **Welcome, existing password** (EN/AR): tells the person to log in with their existing password and points
      to "Forgot password?" if they don't remember it.
- [x] **Reset code** (EN/AR): contains the 6-digit code and says it expires in 10 minutes.
- [x] In tests each email lands in the outbox exactly once with the right recipient, language and content.
- [x] In development the console shows recipient, subject and body, and sending never crashes the request.
- [x] Asking for an unknown template fails loudly (programmer error).
- [x] The user is told which variables to add to the env example (mail driver, sender, app URL); the agent
      doesn't read or edit env files.

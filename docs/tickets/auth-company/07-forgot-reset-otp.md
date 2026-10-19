# 07: Forgot password, verify code, reset

**What to build:** A person who forgot their password requests a 6-digit code by email, verifies it, and sets a
new password; all their devices are signed out (D14, D18; ADR 0001).

**Blocked by:** 03 Mailer, 04 Login, refresh, logout

**Status:** ready-for-agent

- [ ] Requesting a code for a known email and for an unknown email returns the same 200 body,
      "If an account exists for this email, you'll receive a reset code.", in similar time; only the known email
      receives a reset-code email.
- [ ] Asking again within 60 seconds, or more than 5 times in an hour, → 429 `AUTH_OTP_RESEND_TOO_SOON`
      "Please wait before requesting another code." (for unknown emails too).
- [ ] A new code makes the previous code stop working.
- [ ] A wrong code → 400 `AUTH_OTP_INVALID` "This code is incorrect or has expired. Please try again."; a code
      older than 10 minutes gets the same message.
- [ ] The fifth wrong code → 400 `AUTH_OTP_ATTEMPTS_EXCEEDED` "Too many incorrect attempts. Please request a new
      code."; the correct code no longer works afterwards.
- [ ] The correct code returns a reset token valid for 15 minutes, usable once.
- [ ] Resetting with the token and a valid new password: the new password logs in, the old one doesn't, every
      existing refresh cookie stops working, and a locked person is unlocked.
- [ ] Reusing the token, or using it after 15 minutes → 400 `AUTH_RESET_TOKEN_INVALID`
      "Your reset session has expired. Please start again."
- [ ] Weak password → the password-rule message; confirmation differs → "Passwords do not match"; new equals
      current → "New password must be different from your current one."

# 19: Reset / Set password screen

**What to build:** The existing Reset Password screen works in two modes with the same design: **reset** (after
Verify OTP) and **set** (from the welcome email's setup link) (§4 Reset password, Set password).

**Blocked by:** 18 Verify OTP screen, 08 Temporary password, setup link and forced change

**Status:** in-progress

Verified by the ui-tester agent:

- [ ] Reset mode: valid new + confirm → "Resetting Password..." → "Password reset successfully" →
      "Redirecting to login page..." → login works with the new password; a second browser that was logged in is
      sent to login on its next action.
- [ ] Field errors under the inputs: "Password is required",
      "Password must be 8–72 characters and include an uppercase letter, a lowercase letter, a number and a special character.",
      "Please confirm your password", "Passwords do not match". The hint text stays as designed.
- [ ] New password equal to the current one → "New password must be different from your current one."
- [ ] Reset session older than 15 minutes, or reused → "Your reset session has expired. Please start again." with
      a way back to Forgot Password.
- [ ] Set mode: opening the setup link from the console email → setting a valid password logs the person in and
      lands them on their dashboard.
- [ ] Set mode with a used, replaced or expired link → "This link is invalid or has expired. Ask your
      administrator to resend it."
- [ ] Lint passes.

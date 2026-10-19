# 18: Verify OTP screen

**What to build:** The existing Verify OTP screen checks the code, supports resend, and moves to Reset Password
with the reset token (§4 Verify OTP).

**Blocked by:** 17 Forgot password screen

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] The correct code (from the server console) → "Verifying..." → "OTP verified successfully. Redirecting to
      reset password..." → Reset Password screen.
- [ ] Fewer than 6 digits → "Please enter complete OTP"; nothing is sent.
- [ ] A wrong code → "This code is incorrect or has expired. Please try again."
- [ ] The fifth wrong code → "Too many incorrect attempts. Please request a new code."
- [ ] "RESEND OTP" is disabled while "Resend in …" counts down 60 seconds; afterwards it sends a new code and shows
      "A new OTP has been sent to your email."; the previous code is now rejected.
- [ ] Opening the screen directly without an email → "Email not found. Please go back and enter your email." and a
      way back to Forgot Password.
- [ ] Lint passes.

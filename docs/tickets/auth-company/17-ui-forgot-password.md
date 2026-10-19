# 17: Forgot password screen

**What to build:** The existing Forgot Password screen requests a reset code and moves to Verify OTP (§4 Forgot).

**Blocked by:** 14 UI foundation, 07 Forgot password, verify code, reset

**Status:** done

Verified by the ui-tester agent:

- [x] A registered email → "Sending OTP..." with the button disabled → "If an account exists for this email,
      you'll receive a reset code." → Verify OTP screen showing that email; the code appears in the server console.
- [x] An unregistered email shows exactly the same message and also moves to Verify OTP.
- [x] Empty → "Email is required" under the field; `abc` → "Invalid email address".
- [x] Asking again within 60 seconds → "Please wait before requesting another code."
- [x] "Back to Login" returns to the login screen.
- [x] Lint passes.

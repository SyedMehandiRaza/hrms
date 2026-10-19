# 16: Sign up screen

**What to build:** The existing Sign Up screen registers a company and lands the owner on the dashboard, already
logged in (§4 Sign up, D39 copy change).

**Blocked by:** 14 UI foundation, 06 Sign up

**Status:** in-progress

Verified by the ui-tester agent:

- [ ] Valid form → "Creating Account..." with the button disabled → toast "Company registered successfully." →
      admin dashboard, header shows the new company.
- [ ] Field errors appear under the matching input before submitting: "Company name is required",
      "Company name must be at least 2 characters", "Company name cannot exceed 100 characters",
      "Your name is required", "Name must be at least 2 characters", "Name cannot exceed 100 characters",
      "Email is required", "Invalid email address", "Invalid phone number",
      "Password must be 8–72 characters and include an uppercase letter, a lowercase letter, a number and a special character.",
      "Please confirm your password", "Passwords do not match".
- [ ] The two new max-length strings exist in English and Arabic.
- [ ] Email `admin@hrms.test` → "An account with this email already exists. Log in or reset your password."
- [ ] Phone left empty is accepted.
- [ ] Server error → "Something went wrong. Please try again." and the form keeps the typed values.
- [ ] Lint passes.

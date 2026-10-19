# 06: Sign up

**What to build:** Anyone can register a company and is immediately logged in as its owner. The company starts
with Asia/Riyadh timezone, financial year starting in January (current year OPEN), currency SAR and **no
roles** (D4, D6, D19, D20; ADR 0002).

**Blocked by:** 04 Login, refresh, logout

**Status:** ready-for-agent

- [ ] Valid company name, name, email, optional phone, password and confirmation → 201, logged in (token +
      cookie), current user shows the owner panel, the new company, timezone Asia/Riyadh and currency SAR; one
      OPEN financial year exists; the company has zero roles.
- [ ] Field errors (400 `VALIDATION_FAILED`), each under its field:
      "Company name is required", "Company name must be at least 2 characters",
      "Company name cannot exceed 100 characters", "Your name is required", "Name must be at least 2 characters",
      "Name cannot exceed 100 characters", "Email is required", "Invalid email address", "Invalid phone number",
      "Password must be 8–72 characters and include an uppercase letter, a lowercase letter, a number and a special character.",
      "Please confirm your password", "Passwords do not match".
- [ ] Signing up with an email that has a current account (e.g. `admin@hrms.test`) → 409 `AUTH_EMAIL_TAKEN`
      "An account with this email already exists. Log in or reset your password."
- [ ] An email whose accounts have all ended: with that person's existing password → 201 and the same person
      record is reused; with any other password → the same 409 message.
- [ ] If any step fails, nothing is left behind (no orphan person, company or account).
- [ ] Email is stored trimmed and lowercased.

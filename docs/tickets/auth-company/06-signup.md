# 06: Sign up

**What to build:** Anyone can register a company and is immediately logged in as its owner. The company starts
with Asia/Riyadh timezone, financial year starting in January (current year OPEN), currency SAR and **no
roles** (D4, D6, D19, D20; ADR 0002).

**Blocked by:** 04 Login, refresh, logout

**Status:** done

- [x] Valid company name, name, email, optional phone, password and confirmation → 201, logged in (token +
      cookie), current user shows the owner panel, the new company, timezone Asia/Riyadh and currency SAR; one
      OPEN financial year exists; the company has zero roles.
- [x] Field errors (400 `VALIDATION_FAILED`), each under its field:
      "Company name is required", "Company name must be at least 2 characters",
      "Company name cannot exceed 100 characters", "Your name is required", "Name must be at least 2 characters",
      "Name cannot exceed 100 characters", "Email is required", "Invalid email address", "Invalid phone number",
      "Password must be 8–72 characters and include an uppercase letter, a lowercase letter, a number and a special character.",
      "Please confirm your password", "Passwords do not match".
- [x] Signing up with an email that has a current account (e.g. `admin@hrms.test`) → 409 `AUTH_EMAIL_TAKEN`
      "An account with this email already exists. Log in or reset your password."
- [x] An email whose accounts have all ended: with that person's existing password → 201 and the same person
      record is reused; with any other password → the same 409 message. A wrong existing password counts
      toward the login lockout (D19, decided 2026-10-19): the 5th consecutive wrong one → 423
      `AUTH_ACCOUNT_LOCKED`; while locked → 423 even with the right password; the right password clears the count.
- [x] If any step fails, nothing is left behind (no orphan person, company or account).
- [x] Email is stored trimmed and lowercased.

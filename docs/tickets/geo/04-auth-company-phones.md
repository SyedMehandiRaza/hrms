# 04: Sign-up and company profile use the new phone rule

**What to build:** The sign-up phone and the Company profile phone are stored and checked as E.164 with a phone
country, and `GET /company` / `GET /auth/me` return the company country (plan D11, D15–D19, §7).

**Blocked by:** 02 Phone service + data migration, 03 Countries and cities API

**Status:** done

The old phone rule changed, so the existing sign-up and company tests are updated to the new rule (not weakened).

- [x] Sign up with `{ phone: "0501234567", phoneCountry: "SA" }` → the company phone is `+966501234567` / SA.
- [x] Sign up with an invalid number → 400 `VALIDATION_FAILED`, phone "Enter a valid phone number for the selected
      country."; no phone → still allowed (it's optional).
- [x] `PUT /company` with a valid phone and country → saved as E.164; invalid → the same field message; missing →
      "Phone is required".
- [x] `GET /company` returns `phone`, `phoneCountry` and the company country (id, iso2, name); `GET /auth/me` includes
      `company.country`.
- [x] A second company's data is unaffected.

Notes (2026-10-20): `GET /company` keeps its snake_case shape (the Company Profile screen reads it): the phone is
`company_phone_number` (E.164) with `phone_country`, plus `country: { id, iso2, name, callingCode }`. `GET /auth/me`
has the same `company.country`. Requests send `phone` + `phoneCountry`. The old keys `phoneInvalid` / `phoneDigits`
are retired from the catalog and standards §7.2.

# 10: Company profile and logo API

**What to build:** Every login can read its company's basics; only the owner edits the profile and logo
(D2, D27–D29, D33, D37). Deferred fields (legal name, website, tax IDs, currency, working days) are not built.

**Blocked by:** 04 Login, refresh, logout (Auth)

**Status:** done

- [x] Each test user, including the staffing company, reads their own company: name, industry, email, phone,
      address, logo URL, created date, timezone, currency SAR. The industry list is readable for the dropdown.
- [x] The owner saves name, industry, email, phone and address → 200, and reading again shows the new values
      (email lowercased).
- [x] A sub-admin, even with every role flag, gets 403 "You don't have permission to do this." on save, logo
      upload and logo remove.
- [x] Field errors under each field: "Company name is required", "Company name must be at least 2 characters",
      "Company name cannot exceed 100 characters", "Please select an industry", "Phone is required",
      "Enter a valid phone number (6–15 digits)", "Email is required", "Enter a valid email",
      "Address is required", "Address cannot exceed 500 characters".
- [x] A PNG or JPG up to 2 MB becomes the logo and its URL is returned; a 2.1 MB image, a GIF, an SVG, or a text
      file renamed to `.png` → 400 `COMPANY_LOGO_INVALID` "Logo must be a JPG or PNG image up to 2 MB."
- [x] Replacing the logo deletes the old file; removing it clears the logo and deletes the file.
- [x] A second company's owner only ever reads and changes their own company.
- [x] Profile changes are written to the server log (who, which fields). The user is told to add the upload
      directory variable to the env example.

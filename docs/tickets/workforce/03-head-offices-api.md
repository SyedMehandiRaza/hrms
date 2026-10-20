# 03: Head offices API

**What to build:** Admins can list, create, view, edit and delete head offices and their image, with the derived
Active/Unassigned status (D1–D6, ADR 10).

**Blocked by:** 01 Schema changes; geo 02 Phone service, geo 03 Countries and cities API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Head office".

- [x] When a user with `office:create` creates "Riyadh HQ" with valid email, phone and location → 201, listed as Unassigned.
- [x] When they create "riyadh hq" again → 409 `OFFICE_NAME_TAKEN` "A head office with this name already exists."
- [x] Missing or invalid name (incl. over 100 characters, double spaces), email, phone, location or lat/lng → 400
      `VALIDATION_FAILED` "Please fix the highlighted fields." with the §7.2 text under each field key.
- [x] Uploading a JPG or PNG up to 2 MB → stored and returned as the image URL, the old file is deleted; `DELETE` on
      the image removes it.
- [x] Image not a JPG/PNG (by magic bytes) or over 2 MB → 400 `OFFICE_IMAGE_INVALID` "Image must be a JPG or PNG up to 2 MB."
- [x] Country (required, default company country) and city (optional, must be in that country) are saved; the phone
      is stored as E.164 with its phone country (`docs/plans/countries-cities-phones.md` D7, D15–D19).
- [x] A head office linked to a project shows status Active and the project's name.
- [x] When the user deletes an Unassigned head office → it disappears and its name can be reused.
- [x] When the user deletes a head office with a project → 409 `OFFICE_IN_USE` "This head office has a project and can't be deleted."
- [x] The list returns the four stats (total offices, active offices = with a project, total locations = distinct
      trimmed case-insensitive locations, total projects) and per office: employees = ACTIVE + IN_NOTICE employees with
      a current assignment on its project; contract employees = those of them with employment type CONTRACT.
- [x] A user without `office:*`, or a STAFFING_COMPANY login → 403 `FORBIDDEN` "You don't have permission to do this."
- [x] Another company's head office id → 404 `NOT_FOUND` "The requested record was not found."

Notes (2026-10-20): request body `{ name, email, phone, phoneCountry, location, latitude?, longitude?, countryId,
cityId? }`; responses are snake_case (`status` ACTIVE | UNASSIGNED, `project`, `employee_count`,
`contract_employee_count`, `country`, `city` in the request language); list `?search=&status=&page=&limit=` with
`stats { total_offices, active_offices, total_locations, total_projects }`. Image: multipart field `image`. Shared
image rule `backend/src/utils/imageFile.js` (also used by the company logo now).

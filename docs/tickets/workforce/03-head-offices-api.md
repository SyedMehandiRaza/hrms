# 03: Head offices API

**What to build:** Admins can list, create, view, edit and delete head offices and their image, with the derived
Active/Unassigned status (D1–D6, ADR 10).

**Blocked by:** 01 Schema changes; geo 02 Phone service, geo 03 Countries and cities API

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Head office".

- [ ] When a user with `office:create` creates "Riyadh HQ" with valid email, phone and location → 201, listed as Unassigned.
- [ ] When they create "riyadh hq" again → 409 `OFFICE_NAME_TAKEN` "A head office with this name already exists."
- [ ] Missing or invalid name (incl. over 100 characters, double spaces), email, phone, location or lat/lng → 400
      `VALIDATION_FAILED` "Please fix the highlighted fields." with the §7.2 text under each field key.
- [ ] Uploading a JPG or PNG up to 2 MB → stored and returned as the image URL, the old file is deleted; `DELETE` on
      the image removes it.
- [ ] Image not a JPG/PNG (by magic bytes) or over 2 MB → 400 `OFFICE_IMAGE_INVALID` "Image must be a JPG or PNG up to 2 MB."
- [ ] Country (required, default company country) and city (optional, must be in that country) are saved; the phone
      is stored as E.164 with its phone country (`docs/plans/countries-cities-phones.md` D7, D15–D19).
- [ ] A head office linked to a project shows status Active and the project's name.
- [ ] When the user deletes an Unassigned head office → it disappears and its name can be reused.
- [ ] When the user deletes a head office with a project → 409 `OFFICE_IN_USE` "This head office has a project and can't be deleted."
- [ ] The list returns the four stats (total offices, active offices = with a project, total locations = distinct
      trimmed case-insensitive locations, total projects) and per office: employees = ACTIVE + IN_NOTICE employees with
      a current assignment on its project; contract employees = those of them with employment type CONTRACT.
- [ ] A user without `office:*`, or a STAFFING_COMPANY login → 403 `FORBIDDEN` "You don't have permission to do this."
- [ ] Another company's head office id → 404 `NOT_FOUND` "The requested record was not found."

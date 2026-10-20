# 08: Leave types / policies API

**What to build:** Admins manage leave types, each with exactly one policy edited together (D30–D32).

**Blocked by:** 01 Schema changes

**Status:** done

- [x] When a user with `leave_type:create` creates "Annual Leave" / ANNUAL with quota 21 → 201 with one policy.
- [x] A duplicate name → 409 `LEAVE_TYPE_NAME_TAKEN` "A leave type with this name already exists."; a duplicate code →
      409 `LEAVE_TYPE_CODE_TAKEN` "A leave type with this code already exists."
- [x] 400 `VALIDATION_FAILED` with the `docs/standards.md` §7.2 "Leave type / policy" texts for: name (missing,
      under 2, over 150, emoji), code (missing, over 10, not A-Z0-9), quota outside 0–365, accrual method missing,
      negative monthly accrual, effective-to not after effective-from, carry-forward max ≤ 0 or expiry outside 0–36,
      encashment max ≤ 0, year-end excess missing.
- [x] Monthly accrual is ignored when the accrual method is UPFRONT.
- [x] Editing changes the policy in place.
- [x] "Save as new version" → 409 `LEAVE_POLICY_VERSIONING_DISABLED` "Policy versions aren't available yet."
- [x] A deactivated type drops out of the assignable list; employees who have it keep it.
- [x] Deleting a type that was ever assigned → 409 `LEAVE_TYPE_IN_USE`
      "This leave type is assigned to employees and can't be deleted."
- [x] `FORBIDDEN` without `leave_type:*`; another company's type → `NOT_FOUND`.

Notes (2026-10-20): POST and PUT take the whole modal (keys per standards §7.2: `name, code` and the policy's
snake_case fields; omitted flags take their defaults). The response is one flat object (type + policy, `policy_id`,
`assigned_employees`). Active/inactive via `is_active`; the assignable list is `GET /leave-types?status=ACTIVE`.
A never-assigned type is deleted outright (the table has no soft delete).

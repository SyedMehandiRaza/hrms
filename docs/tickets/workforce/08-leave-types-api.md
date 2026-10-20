# 08: Leave types / policies API

**What to build:** Admins manage leave types, each with exactly one policy edited together (D30–D32).

**Blocked by:** 01 Schema changes

**Status:** ready-for-agent

- [ ] When a user with `leave_type:create` creates "Annual Leave" / ANNUAL with quota 21 → 201 with one policy.
- [ ] A duplicate name → 409 `LEAVE_TYPE_NAME_TAKEN` "A leave type with this name already exists."; a duplicate code →
      409 `LEAVE_TYPE_CODE_TAKEN` "A leave type with this code already exists."
- [ ] 400 `VALIDATION_FAILED` with the `docs/standards.md` §7.2 "Leave type / policy" texts for: name (missing,
      under 2, over 150, emoji), code (missing, over 10, not A-Z0-9), quota outside 0–365, accrual method missing,
      negative monthly accrual, effective-to not after effective-from, carry-forward max ≤ 0 or expiry outside 0–36,
      encashment max ≤ 0, year-end excess missing.
- [ ] Monthly accrual is ignored when the accrual method is UPFRONT.
- [ ] Editing changes the policy in place.
- [ ] "Save as new version" → 409 `LEAVE_POLICY_VERSIONING_DISABLED` "Policy versions aren't available yet."
- [ ] A deactivated type drops out of the assignable list; employees who have it keep it.
- [ ] Deleting a type that was ever assigned → 409 `LEAVE_TYPE_IN_USE`
      "This leave type is assigned to employees and can't be deleted."
- [ ] `FORBIDDEN` without `leave_type:*`; another company's type → `NOT_FOUND`.

# 16a: Raise exit + exit list/detail + exit settings API

**What to build:** A resignation or termination can be raised with validated terms and goes to the leaving
employee's approval group; exits can be listed and viewed, and the Exit settings defaults can be read and saved
(D58, D61, D62, D66, exit settings).

**Blocked by:** 11b Approval edge rules, 13a Create employee core

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Exit (raise, edit terms)" and "Exit settings".

- [ ] When a user with `employee:create` and `employee:update` raises a termination → exit PENDING_APPROVAL, an EXIT
      request to the employee's group (owner-only when they have none), exit event RAISED; the employee stays ACTIVE
      with their login.
- [ ] A user with only one of the two permissions → `FORBIDDEN`.
- [ ] A login with an ACTIVE employee record raises their own resignation (reason, optional preferred last day) →
      notice days from Exit settings; the owner (no employee record) or a STAFFING_COMPANY login → `FORBIDDEN`.
- [ ] Raising a termination for yourself → employeeId "You cannot raise an exit for yourself".
- [ ] The owner can't be the subject of an exit (no employee record → `NOT_FOUND`).
- [ ] A second open exit for the same employee → 409 `EXIT_ALREADY_OPEN` "This employee already has an open exit.";
      two raises at the same moment → one succeeds, the other gets `EXIT_ALREADY_OPEN`.
- [ ] 400 `VALIDATION_FAILED` with the §7.2 texts for: reason under 10 / over 1000, a reason category of the wrong type
      (ABSCONDING is a termination reason), notice days outside 0–180, notice start outside ±90 days, LWD before the
      notice start or more than 365 days after it.
- [ ] LWD defaults to start + days − 1, and 0 notice days gives LWD = start.
- [ ] A non-owner setting an LWD in the past → lastWorkingDay "Last working day cannot be in the past"; the owner can
      (e.g. absconding, 0 notice days).
- [ ] Settlement choices (encash, loan handling, rehire eligible, cooling days 0–1095) are saved as entered.
- [ ] Exit list (filters: status, type, reason, LWD month, search) and detail need `exit:read`; Exit settings read
      needs `exit:read`, update `exit:update` (notice 0–180, cooling 0–1095).
- [ ] Another company's employee or exit → `NOT_FOUND`.

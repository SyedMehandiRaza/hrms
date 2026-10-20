# 13b: At-create setup — leave, shift, salary

**What to build:** Creating an employee also sets up their leave policies and balances, shift and salary structure
in the same transaction (D33, D34, D40, D52). Routing is done in 13a.

**Blocked by:** 13a Create employee core, 06 Shifts API, 08 Leave types API, 09 Salary components API

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Employee (create, edit)".

- [ ] Leave: no policy → leavePolicyIds "Select at least one leave policy"; two policies of the same type → "Choose one
      policy per leave type."; an inactive one → "Select active leave policies only."; each assignment starts on the
      joining date.
- [ ] UPFRONT policy, 21 days, prorate on, joining 1 July in a Jan–Dec FY → balance 10.5 with one CREDIT ledger row
      (source SYSTEM).
- [ ] MONTHLY_ACCRUAL policy → balance 0, no ledger row.
- [ ] Joining date in a previous FY → only the current FY balance is created.
- [ ] Joining date in the next FY, which exists → that FY's balance, prorated from the joining date; next FY not created
      yet → no balance row and no error.
- [ ] Shift: optional; when given, stored with a history row effective from the joining date; another company's
      shift → `NOT_FOUND`.
- [ ] Salary currency other than SAR → currency "Currency must be SAR."
- [ ] Mode not allowed for the employment type (Full-time + HOURLY, staffing-company contract + MONTHLY_HOURLY) →
      salaryMode "This salary mode isn't available for this employment type."
- [ ] Monthly modes: missing BASIC, HOUSING or TRANSPORT → components "Basic, Housing and Transport are required.";
      Basic 0 → "Basic salary must be more than 0."; a duplicate → "A component is selected more than once"; an
      inactive component → "Select active components only."; a negative amount → "Enter a valid amount (≥ 0) for every
      component"; PERCENTAGE over 100 → "A percentage component cannot exceed 100"; percentage rows store
      `percent_base=["BASIC"]`.
- [ ] MONTHLY_HOURLY without working hours, 0 or over 24 → workingHours "Enter working hours per day (1–24)"; HOURLY
      with rate 0 → hourlyRate "Enter an hourly rate greater than 0"; min hours below 0 → minHours "Minimum hours must
      be ≥ 0".
- [ ] Overtime rate outside 1–5 or not a 0.5 step → overtimeRate "Overtime rate must be 1–5 in steps of 0.5."; default
      1.5 (1 for a staffing-company worker).
- [ ] The salary is saved effective from the joining date as the only active salary.
- [ ] A failure in any of these rolls back the whole employee.

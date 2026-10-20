# 13b: At-create setup — leave, shift, salary

**What to build:** Creating an employee also sets up their leave policies and balances, shift and salary structure
in the same transaction (D33, D34, D40, D52). Routing is done in 13a.

**Blocked by:** 13a Create employee core, 06 Shifts API, 08 Leave types API, 09 Salary components API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Employee (create, edit)".

- [x] Leave: no policy → leavePolicyIds "Select at least one leave policy"; two policies of the same type → "Choose one
      policy per leave type."; an inactive one → "Select active leave policies only."; each assignment starts on the
      joining date.
- [x] UPFRONT policy, 21 days, prorate on, joining 1 July in a Jan–Dec FY → balance 10.5 with one CREDIT ledger row
      (source SYSTEM).
- [x] MONTHLY_ACCRUAL policy → balance 0, no ledger row.
- [x] Joining date in a previous FY → only the current FY balance is created.
- [x] Joining date in the next FY, which exists → that FY's balance, prorated from the joining date; next FY not created
      yet → no balance row and no error.
- [x] Shift: optional; when given, stored with a history row effective from the joining date; another company's
      shift → `NOT_FOUND`.
- [x] Salary currency other than SAR → currency "Currency must be SAR."
- [x] Mode not allowed for the employment type (Full-time + HOURLY, staffing-company contract + MONTHLY_HOURLY) →
      salaryMode "This salary mode isn't available for this employment type."
- [x] Monthly modes: missing BASIC, HOUSING or TRANSPORT → components "Basic, Housing and Transport are required.";
      Basic 0 → "Basic salary must be more than 0."; a duplicate → "A component is selected more than once"; an
      inactive component → "Select active components only."; a negative amount → "Enter a valid amount (≥ 0) for every
      component"; PERCENTAGE over 100 → "A percentage component cannot exceed 100"; percentage rows store
      `percent_base=["BASIC"]`.
- [x] MONTHLY_HOURLY without working hours, 0 or over 24 → workingHours "Enter working hours per day (1–24)"; HOURLY
      with rate 0 → hourlyRate "Enter an hourly rate greater than 0"; min hours below 0 → minHours "Minimum hours must
      be ≥ 0".
- [x] Overtime rate outside 1–5 or not a 0.5 step → overtimeRate "Overtime rate must be 1–5 in steps of 0.5."; default
      1.5 (1 for a staffing-company worker).
- [x] The salary is saved effective from the joining date as the only active salary.
- [x] A failure in any of these rolls back the whole employee.

Notes (2026-10-21): `POST /employees` now also takes `leavePolicyIds`, `shiftId?`, `currency?` (default SAR),
`salaryMode`, `workingHours?`, `hourlyRate?`, `minHours?`, `overtimeRate?` and `components:
[{ componentId, calculationType?: FIXED|PERCENTAGE, amount }]`. Every component error is reported under `components`.
UPFRONT balances fill accrued, total allocated and available, and write a CREDIT/SYSTEM ledger row dated from the
start of the entitlement (the joining date, or the FY start for an earlier joining date). The ledger row references
the employee. MONTHLY_ACCRUAL balances start at 0 and write no ledger row. In HOURLY mode the hourly rate is saved
as an `HOURLY` component row. In monthly modes, Basic must be a fixed amount, and choosing the Hourly component
gives "Select active components only." (it is HOURLY-mode only, D42). Tests:
`backend/tests/employees-create-setup.test.js`; shared fixtures in `backend/tests/helpers/employees.js`.

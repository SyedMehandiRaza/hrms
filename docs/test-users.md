# Test users (DEV / TEST database only — never real accounts)

Created by the backend seeders (`cd backend && npm run db:seed`).
The ui-tester agent logs in with these. All belong to the company "Al Noor Construction".

| Access level     | Panel            | Email               | Password   | Notes |
|------------------|------------------|---------------------|------------|-------|
| ADMIN            | Admin            | admin@hrms.test     | Test@12345 | Company owner. Bypasses role permission checks. |
| SUB_ADMIN        | Admin            | subadmin@hrms.test  | Test@12345 | Omar Siddiqui (EMP-0001), role "Sub Admin". Level-1 approver of "General Approval" (the one group for all requests; Fatima Al-Zahrani, EMP-0002, is level 2). |
| STAFFING_COMPANY | Staffing company | staffing@hrms.test  | Test@12345 | Gulf Manpower Services (supplies EMP-0007 and EMP-0008). |
| GENERAL_EMPLOYEE | Employee         | employee@hrms.test  | Test@12345 | Sara Khan (EMP-0003), role "Employee". Has a pending leave, overtime and exit visa. |

Access levels and panels: ADMIN and SUB_ADMIN use the Admin panel; EMPLOYEE and GENERAL_EMPLOYEE use
the Employee panel; STAFFING_COMPANY uses the Staffing-company panel. What a login can do inside its
panel comes from its role's module permissions (see `docs/backend-plan.md`, decisions D2/D3/P1).

Seeded workforce (docs/plans/workforce-and-lifecycle.md): two head offices, each with one project —
Riyadh Head Office → King Salman Park - Phase 2 (PRJ-FY26-0001), Jeddah Head Office → Jeddah Waterfront Towers
(PRJ-FY26-0002). Every seeded employee (EMP-0001…EMP-0008) is routed to "General Approval"; the next new employee
gets EMP-0009 and the next FY 2026 project PRJ-FY26-0003.

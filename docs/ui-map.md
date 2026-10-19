# UI map

Inventory of the React UI in `hrms/`, copied from `hrms_copy/` on 2026-10-19 with nothing changed.
For table and column detail, plus the UI ↔ schema gaps, see `docs/schema-review.md`.

---

## 1. Stack

| Concern | What it is |
|---|---|
| Bundler | **Vite 8** (`@vitejs/plugin-react`, `@tailwindcss/vite`). No dev proxy, and no `import.meta.env` used yet |
| Framework | **React 19.2** (StrictMode), entry `src/main.jsx` → `src/App.jsx` |
| Router | **react-router-dom 7** with `BrowserRouter`. Routes are in `src/routes/AppRoutes.jsx`, `AdminRoutes.jsx`, `EmployeeRoutes.jsx` and `StaffingCompanyRoutes.jsx` |
| State | **No state library.** Pages use local `useState`, plus a few `useSyncExternalStore` stores: `src/pages/newContract/newContractStore.js`, `useContractTypes` in `src/data/groupF.js`, and the notification store in `src/data/groupA.js` |
| Styling / UI | **Tailwind CSS v4** only, with no component library. Icons from `react-icons`; Cairo font from Google Fonts |
| Forms | `react-hook-form` (49 files) |
| Toasts | `react-toastify` (configured in `App.jsx`, RTL-aware). `react-hot-toast` is installed but unused |
| i18n | `i18next` + `react-i18next`, **en / ar**, 25 namespaces in `src/locales/{en,ar}/`. Arabic switches `<html dir="rtl">`, and the language is kept in `localStorage.lang` |
| Maps / files | `leaflet` + `react-leaflet` (location picker; geocoding is stubbed), `pdfjs-dist` (PDF viewer), `xlsx` (Excel export in 3 screens) |
| Unused dependencies | `recharts` (charts are hand-built), `pdf-lib`, `react-hot-toast`, `react-leaflet-cluster` |
| Data | **All static.** Data comes from `src/data/` (`common.js`, `session.js`, `groupA.js` … `groupH.js`, `groupD/*`) plus a few page-local mocks. There's **no API layer**: no axios, no `src/api/`, and no fetch calls |
| Auth / guards | Stubbed. `ProtectedRoute` renders children as-is, `useCan()` always returns true, and `getStaticUser()` picks the user from the URL prefix (`/employee` → employee, `/staffing-company` → staffing company, anything else → admin/owner) |
| API helpers already present | `src/utils/apiError.js`, `src/utils/applyFieldErrors.js`. They expect axios-style errors `{response:{data:{message, errors}}}` |

`hrms/CLAUDE.md` expects `src/api/client.js` (axios, `VITE_API_URL`, refresh on 401). That file **doesn't exist yet**.

---

## 2. Build, lint and runtime results (2026-10-19)

| Check | Result |
|---|---|
| `npm install` | OK. `npm audit` reports 11 vulnerabilities: 1 low, 2 moderate, 8 high, 0 critical. I didn't run `audit fix` |
| `npm run build` | **OK** (443 modules, 2.97 s). Warning: the main chunk `index-*.js` is **3.98 MB** (979 kB gzip), over the 500 kB limit. There's no code-splitting |
| `npm run lint` | **FAIL: 82 problems (43 errors, 39 warnings)**. Details below |
| Dev server + browser | **Every route renders.** I checked all 115 routes in Playwright, including all tabs on employee detail and settings. There were **0 console errors or warnings, 0 failed requests and 0 broken images**. EN → AR switches to RTL correctly |

**Lint breakdown:**
- **Errors:**
  - `no-unused-vars` ×36. Mostly unused `React` imports in the route files, plus `AuthLeft.jsx`, `Invoices.jsx` and `SearchResult.jsx`.
  - `react-hooks/set-state-in-effect` ×4.
  - `react-hooks/static-components` ×2.
  - `no-dupe-keys` ×1: `SHIFT` appears twice in `src/constants/permissions.js`.
- **Warnings:**
  - `react-hooks/incompatible-library` ×34 (react-hook-form `watch()`).
  - `react-hooks/exhaustive-deps` ×5.

**Other known issues (not fixed):**
- `AppRoutes.jsx` imports `../pages/auth/VerifyOTP`, but the file is `VerifyOtp.jsx`. This works on Windows and **will break the build on Linux/CI**.
- `src/pages/audit.cjs` is a stray Node script with a hardcoded `e:/Project-Fyinder/...` path.
- These files are unused: `pages/PageTemplate.jsx`, `pages/employee_dashboard/Dashboard/MyComponent.jsx`, `pages/loans/LoanDetailModal.jsx`, `components/EmployeeAttendanceDetailsModal.jsx`, `components/yearEnd/useRemote.js`.
- There's no 404 route. Unknown URLs show an empty layout, or a blank white page if the URL is outside every layout.
- `/unauthorized` is just the text "Unauthorized" with no layout.

### Dead links (confirmed in the browser)

| # | Where | Link target | Result |
|---|---|---|---|
| 1 | `src/pages/payroll/RunPayroll.jsx:72` | `/admin/payroll` | Empty content area. It should be `/admin/payroll-overview` |
| 2 | `src/pages/documents/AddNewDocument.jsx:188, 487` (Cancel) | `/documents` | Blank white page (missing `/admin`). Save and View Guide do nothing |
| 3 | `src/pages/invoice/Invoices.jsx:478` (row) | `/invoices/invoice-detail` | Blank white page (missing `/admin`). The anchors are also 0×0 px |
| 4 | Invoice detail "Invoices" button | none | The button has no handler |
| 5 | `src/pages/staffingCompanies/InvoiceView.jsx:112` (breadcrumb) | `/staffing-companies/company-detail/1` | Blank white page (missing `/admin`) |
| 6 | `src/pages/employee_dashboard/Dashboard/EmployeeDashboard.jsx:102-104` (quick actions) | `/employee/overtime`, `/employee/correction`, `/employee/documents` | Empty content area. These routes don't exist |
| 7 | `src/components/CorrectionRequestModal.jsx:205` | `href="#"` | Placeholder link |

Buttons that don't navigate:
- "View project" on `/admin/projects`.
- The row and Edit button on `/admin/departments`. "View designations" does work.
- Loan approval rows.
- There's no link from Settings → Financial Year to `/admin/fiscal-years/:yearKey/close`.

Hardcoded routes:
- `staffing-companies/company-detail/1/view-invoice` has the id fixed at 1.
- `invoices/invoice-detail` has no id parameter.

---

## 3. Roles and portals

The UI is built around **three portals**. They don't match the SUPER_ADMIN/HR/MANAGER/EMPLOYEE roles in the project docs; see schema-review Q1.

| Portal | Prefix | Layout | Sidebar | Intended user |
|---|---|---|---|---|
| Admin | `/admin/*` | `src/layouts/AdminLayout.jsx` (Sidebar, Header, ReadOnlyYearBanner) | `src/components/Sidebar.jsx`. Items are gated by permissions (`payroll:read`, `leave:update`, approver roles…), but the gates are bypassed today | Company owner/admin and sub-admins. Also includes "My Requests" for the admin as an employee |
| Employee | `/employee/*` | `src/layouts/EmployeeLayout.jsx` | `src/components/SidebarForEmployee.jsx` | Employee self-service and approver inbox |
| Staffing company | `/staffing-company/*` | `src/layouts/StaffingCompanyLayout.jsx` | `src/components/SidebarForStaffingCompany.jsx` | External manpower supplier |

The header (`src/components/Header.jsx`) has global search (static), a project filter, the EN/AR toggle, a notifications panel with approve/reject, the financial-year switcher, and a profile menu with logout.

---

## 4. Screen inventory

Page paths are relative to `hrms/src/pages/`. Fields use the English labels. "Tables" names the main schema tables each screen needs; the full mapping is in schema-review section 4.

### 4.1 Public / auth

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `/`, `/login` | `auth/Login.jsx` | Email, Password (min 8), Forgot password?, Log In, Sign Up link | users, hrms_accounts, hrms_sessions |
| `/signup` | `auth/SignUp.jsx` | Company Name, Your Name (min 2), Email, Phone (optional), Password, Confirm | users, employers, hrms_accounts |
| `/forgot-password` | `auth/ForgotPassword.jsx` | Email → Send OTP | **OTP storage missing** |
| `/verify-otp` | `auth/VerifyOtp.jsx` | 6-digit code, resend timer | **OTP storage missing** |
| `/reset-password` | `auth/ResetPassword.jsx` | New and Confirm password (8+ characters with upper, lower, digit and special) | hrms_accounts |
| `/invitations/token/:token` | `auth/InviteLanding.jsx` | Invite summary (company, role, parent, N projects). Company Name, Your Name, Phone, Password, Confirm → Register & Join | project_invitations, employers, users |
| `/access-ended` | `auth/AccessEnded.jsx` | Message and back to sign in | (exits / accounts status) |
| `/unauthorized` | inline | Text only | none |

### 4.2 Admin portal (`/admin/...`)

**Dashboard & search**

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `dashboard` | `dashboard/Dashboard.jsx` | **Cards:** Total Employees (+new), Active Projects, Pending Approvals, Payroll Status, Expiring Documents. **Panels:** Employee distribution (full-time vs contract); Attendance (present / absent / on leave); Action Center (approve/reject leave, OT, correction, encashment, loan); Payroll snapshot; Compliance alerts (employee, doc type, expiry, status, View/Notify/Renew); Recent activity; Active projects. **Buttons:** Export xlsx, New Hire, Run Payroll | aggregates (employees, projects, approvals, payroll, documents, attendance) |
| `dashboard/search-results` | `searchResult/SearchResult.jsx` | Static results | none |

**People**

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `employees` | `employees/Employees.jsx` (+ `EmployeeDrafts.jsx`) | **Filters:** Project, Type, Role, Status, Search. **Columns:** S.N, Employee ID, Iqama No., Name (+status, email), Role, Type, Project, Staffing Co. **Actions:** bulk activate/deactivate. **Drafts tab:** Name, Progress, Last saved, Saved by, Resume/Delete | employees, users, roles, projects, hrms_staffing_companies, hrms_employee_drafts |
| `employees/add-employee[?draft=]` | `employees/AddEmployee.jsx` | **5-step wizard:** Basic (photo, name, nationality, phone, email, country ID, accommodation, address) → Job (employment type, role, access level, projects + main project, leave policies, staffing company, shift, department → designation, joining date) → Salary (currency, calc mode, OT rate, hours/day, hourly rate, min hours, component rows) → Documents (Iqama first, then other docs) → Review. Save as draft | employees, users, employee_projects, hrms_employee_leave_policies, hrms_employee_salary(+_components), hrms_employee_documents, hrms_employee_drafts |
| `employees/:id` | `employees/EmployeeDetail.jsx` | **Header actions:** Generate payslip, Edit info (+approval routing), Resignation/Termination wizard. **Tabs:** Overview; Projects (current, past, history); Attendance (KPIs + log); Payroll (structure, payslip history, salary history, add increment); Documents (status and review, approve/reject); Dependent (name, relationship, ID, DOB, document, status, verify/reject) | employees, hrms_employee_project_history, hrms_attendance, hrms_payroll(+items), hrms_salary_increment_lines, hrms_employee_documents, hrms_employee_dependents, employee_approval_routing, hrms_employee_exits |
| `exits` | `exits/ExitList.jsx` | **Tabs:** In notice / Exited / Completed / Cancelled. **Filters:** type, reason, LWD month, awaiting confirmation. **Columns:** Employee, Type, Reason, LWD (days left, extended), Checklist, Status | hrms_employee_exits, hrms_exit_checklist_items |
| `exits/:id` | `exits/ExitDetail.jsx` | Summary, LWD history, clearance checklist (8 categories), final settlement, exit documents (4 types, regenerate/email), activity. **Actions:** edit terms, cancel, rehire, confirm | hrms_employee_exits, _checklist_items, _exit_documents, _exit_events, hrms_loans, hrms_leave_balances |
| `departments` | `departments/Departments.jsx` | **Stats.** **Columns:** S.No, Name, Head, Designations, Status. **Modal:** Name, Code, Head, Description, Active | hrms_departments |
| `departments/:id` | `departments/DepartmentDetail.jsx` | Code, Head, Created, Total employees. Designations table and modal (Name, Code, Description, Active) | hrms_designations, employees |
| `invitations` | `invitations/Invitations.jsx` | **Tabs:** Received, Sent, Approvals, My Collaborations, Hierarchy, Roles. Invite wizard (company/email, projects, role, parent, collaboration role). Partner company and partner employee views. Role R/C/U/D matrix | project_invitations, project_participants, _edges, _closure, project_collaboration_roles(+permissions), project_employee_deployments |

**Attendance**

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `attendance` | `attendance/Attendance.jsx` | Daily/monthly view. **Stats:** present, absent, weekly off/holiday, missing check-ins. **Filters:** date (range), project, status. **Columns:** Employee, Project, In, Out, Hours, Status (P/I/A/WO/H/L/NA/OP). Day timeline modal | hrms_attendance, company_shifts, shift_week_offs, hrms_holidays, hrms_leave_request_days |
| `attendance/reports` | `attendance/AttendanceReports.jsx` | Employee monthly (morning/afternoon/OT in-out, daily hours, approved by, remarks) and all-employees grid. Excel export | hrms_attendance (**approved by / remarks missing**) |
| `attendance/request` | `attendance/OvertimeRequest.jsx` | **Tabs:** Employee / Bulk. **Filters:** project, status, dates. **Columns:** Employee, Project, Date, Hours, Rate, Status, Level. New Request | hrms_overtime_requests, hrms_approval_requests |
| `attendance/request/new` | `attendance/NewOvertimeRequest.jsx` | Pick employees, then Project, Date, Start/End (overnight allowed), Reason | hrms_overtime_requests (batch_id) |
| `attendance/request/bulk-approval?batch=` | `attendance/BulkOvertimeApprovalView.jsx` | Batch info, per-employee status and level. Approve selected, reject the rest | hrms_overtime_requests, approvals |
| `attendance/correction-requests` | `attendance/CorrectionRequest.jsx` | Pending approvals (Employee, Date, Hours, Reason, Level, Approve/Reject with reason). New request | hrms_attendance_correction_requests, approvals |

**Payroll & finance**

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `payroll-overview` | `payroll/PayrollOverview.jsx` | **Filters:** month, project, status. **Columns:** Payroll Ref, Month, Period, Project, Staff, Net, Status (Draft → Pending Approval → Approved/Rejected → Credited/Paid). Run Payroll | hrms_payroll_runs (**ref, period start/end missing**) |
| `payroll-overview/run-payroll` | `payroll/RunPayroll.jsx` | Month, Start/End date, Project (or all) | hrms_payroll_runs |
| `payroll-overview/payroll-preview-monthly?runId=` | `payroll/PayrollPreviewMonthly.jsx` | **Cards:** employees, gross, deductions, net. **Rows:** Employee, Dept, Basic, Allowances, Deductions, Net, Status. Expanding a row shows days, OT, add incentive/deduction. **Actions:** Submit, Approve, Reject (reason), Credit | hrms_payroll, hrms_payroll_items |
| `…/employee-payroll-review` | `payroll/EmployeePayrollReview.jsx` | Salary structure, time tracking, incentives, deductions, net | hrms_payroll(+items), hrms_employee_salary |
| `salary-component` | `payroll/SalaryComponent.jsx` | Name, Type (Earning/Deduction), Status, Description. Default components are locked | hrms_salary_components |
| `salary-report` | `payroll/SalaryReport.jsx` | Per project: Employee, Iqama, Designation, Work hrs, Allotted, Per hour, Basic, Allowances, OT hrs/pay, Gross, Advance, Deductions, Net, Sign. Excel export | hrms_payroll(+items), employees, hrms_designations |
| `salary-increments` | `payroll/SalaryIncrements.jsx` | Title, % or fixed, Applies to, Effective month, Employees, Status (Draft/Applied/Reverted). Preview/Apply/Revert | hrms_salary_increment_batches, _lines |
| `annual-reports` | `reports/AnnualReports.jsx` | Generate 7 report types (optionally per employee), view/PDF/CSV/email | hrms_year_documents |
| `fiscal-years/:yearKey/close` | `yearEnd/YearEndWizard.jsx` | Steps: Readiness → Leave (carry/encash/lapse/override) → Payroll → Billing & loans → Next-year setup → Close/Reopen | hrms_financial_years, hrms_year_close_steps, hrms_leave_year_overrides, hrms_period_locks |
| `staffing-billing` | `payroll/StaffingBilling.jsx` | Generate per company/month. **History:** Bill No, Company, Period, Lines, Amount, Status. **Detail:** per-employee hours, gross, OT, net. Submit/Approve/Reject/Send to portal/Mark paid | hrms_staffing_bills, _bill_items, hrms_staffing_rates |
| `payroll-approvals` | `payroll/PayrollApprovals.jsx` | **Tabs:** Pending, Awaiting credit, Credited, All. Approve/Reject/Credit; payslip list | hrms_payroll_runs, approvals |
| `payroll-transactions` | `payroll/Transactions.jsx` | Employee, Project, Month, Type (Advance/Deduct/Earning), Label, Amount, component | hrms_salary_transactions |
| `loan-approvals` | `loans/LoanApprovals.jsx` | **Tabs:** All loans / Skip requests. **Columns:** Loan, Employee, Amount, EMI, Installments, Outstanding, Status, Level. Approve/Request changes (suggested amount and installments)/Reject. New loan | hrms_loans, hrms_loan_skip_requests, approvals |
| `loan-approvals/:id` | `loans/LoanDetailPage.jsx` | EMI schedule, payment history, skip request/approve | hrms_loan_installments, hrms_loan_payments, hrms_loan_skip_requests |
| `leave-encashments` | `payroll/LeaveEncashments.jsx` | Employee, Leave type, Days, Payout month, Amount, Status, Requested on, Approval. Raise on behalf | hrms_leave_encashment_requests |

**Documents & contracts**

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `documents` | `documents/Documents.jsx` | Per employee: total, pending, expiring; expanded doc rows; approve/reject/replace/renew | hrms_employee_documents |
| `document-type` | `documents/DocumentTypes.jsx` | Name, Code, Description, Category (6), Requires expiry, Requires issuer, Status | hrms_document_types |
| `documents/add-new-document` | `documents/AddNewDocument.jsx` | Employee, Type, File, Issue/Expiry date, Authority, Reference no. (Save does nothing) | hrms_employee_documents |
| `contracts`, `contracts/create`, `contracts/:id` | `contract/Contracts.jsx`, `CreateContract.jsx`, `ContractDetails.jsx` | Stats. Contract name, employee, start/end, renewal due, status (8 values). Create: employee, template, name, dates, notes. Detail: recipients (role, status), activity, approve | hrms_contracts, _recipients, _activities, _templates |
| `contract-types` | `contracts/ContractTypes.jsx` | Name, Code, Description, Status | hrms_contract_types (**not linked to contracts**) |
| `new-contracts/dashboard`, `new-contracts`, `new-contracts/documents`, `new-contracts/templates`, `new-contracts/templates/build`, `new-contracts/create` | `newContract/*` | Contract Studio: stats; contracts by status and audience; PDF/DOCX upload; template builder (drag Input/Checkbox/Signature/DB-column fields onto pages); send wizard (template → recipients/sign order → review) | hrms_contract_documents, _templates, _template_fields, hrms_contracts, _recipients, _fields, _activities |

**Leave, holidays, shifts**

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `leave-management` | `leaves/LeaveManagement.jsx` | **Stats.** Pending table (approve/reject/view), upcoming, on leave today, recent, type distribution | hrms_leave_requests, approvals |
| `leave-management/apply-leave` | `leaves/ApplyLeave.jsx` | Type, Session (full/first/second half), Start/End, Reason (10–500), Document. Shows balances and preview | hrms_leave_requests, _request_days, _attachments, hrms_leave_balances |
| `leave-management/leave-policy` | `leaves/LeavePolicy.jsx` (+ `CreateLeaveTypeModal`) | Leave types table. **Modal:** name, code, paid/unpaid, quota, accrual, effective dates, carry forward + max, encashment + max, half day, document required, negative balance, FY rules, "save as new version" | hrms_leave_types, hrms_leave_policies (**no versioning**) |
| `leave-management/leave-calender` | `leaves/LeaveCalender.jsx` | Month/week calendar, filters, employee balances, adjust balance (±days, reason), record leave | hrms_leave_requests, hrms_leave_balances, _balance_transactions, hrms_holidays |
| `leave-management/review-leave-request?id=` | `leaves/ReviewLeaveRequest.jsx` | Request details, balance, approval progress by level. Approve/Reject/Cancel (reason) | hrms_leave_requests, approvals |
| `leave-management/view-all-requests` | `leaves/ViewAllLeaveRequest.jsx` | Search and status filter. Employee, Type, Dates, Status, Level | hrms_leave_requests |
| `holiday-management` | `holiday/HolidayManagement.jsx` | Name, Date, Day, Type (6). **Modal:** global, optional, half day + times, active. Copy to next year | hrms_holidays |
| `shift-management`, `add-shift`, `edit/:id` | `shift/shift.jsx`, `shift/AddShift.jsx` | Name, Start/End. Weekly-off picker per month. Timing history (effective from). Copy week-offs | company_shifts, hrms_shift_time_history, shift_week_offs |

**My Requests (the admin acting as an employee)**: `my-requests/dashboard | overtime | overtime/new | correction | leave | leave/apply-leave | documents | contracts | loans | loans/:id | visa`. These are the same self-service screens as the employee portal (section 4.3). Tables: the corresponding request tables.

**Organisation & partners**

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `projects` | `projects/Projects.jsx` | **Stats.** Latest projects (name, location, employees, contract employees, status). **Tabs:** My projects / Assigned to me (owner company, my role, deploy employees) | projects, employee_projects, project_participants, project_employee_deployments |
| `projects/all` | `projects/ProjectList.jsx` | Searchable list | projects |
| `projects/create-project` | `projects/CreateProject.jsx` | Photo, Name, Office, Location (map), City, Status, Start, Target completion, Radius (m), Description | projects, offices, cities1 |
| `projects/project-detail/:id` | `projects/ProjectDetail.jsx` | Description, dates, radius, offline-attendance toggle; attendance summary; payroll cost; workforce table (role, type, staffing co, status); assign employees; edit | projects, employee_projects, hrms_attendance, hrms_payroll |
| `head-offices`, `head-offices/create-head-office` | `headOffices/*` | **Stats.** Name, Location, Employees, Contract employees, Status. **Create:** photo, name, email, phone (calling code), map location | offices (**status, lat/lng missing**) |
| `staffing-companies`, `add-staffing-company`, `company-detail/:id`, `company-detail/1/view-invoice`, `assign-contract-employees` | `staffingCompanies/*` | List (company, contact, phone, city, employees, status). **Modal:** name, code, email, phone, contact person, city, address, status, projects (login is auto-emailed). Detail (employees table). Assign contract employees (billing rate; mostly static). Invoice view (static) | hrms_staffing_companies, hrms_staffing_company_projects, employees, hrms_staffing_rates |
| `invoices`, `invoices/invoice-detail` | `invoice/*` | Static mock: invoice ID, company, project, amount, issue date, status (Paid/Pending/Overdue), line items | **no invoice table** |
| `approvals` | `approval/Approval.jsx` | **Groups tab:** ID, name, module, levels. **Settings tab:** group per module × project, company default. Create/edit group: name, code, module, scope, approvers (employee, level, mandatory, can skip) | hrms_approval_groups, _members, _assignments |
| `approvals/approval-group/:id` | `approval/ViewApprovalGroup.jsx` | Members and edit members | hrms_approval_group_members |
| `visa-management` | `visa/VisaManagement.jsx` | Employee, Type (single/multiple/final exit), Validity, Exits, Status (7). Approve/Reject/Issue/Record trip/Mark returned/Cancel. Apply for employee | hrms_exit_visas, hrms_exit_visa_trips |
| `settings` | `settings/Settings.jsx` | **8 tabs:** Company profile; User management; Roles & permissions (module × CRUD matrix); Billing (static); Security & SSO (static); Notification (static); Exit settings (+checklist template); Financial year (settings, years, month locks) | employers, hrms_accounts, users, hrms_roles, hrms_permissions, hrms_exit_settings, hrms_exit_checklist_templates, hrms_company_time_settings, hrms_financial_years, hrms_period_locks |
| `profile` | `profile/Profile.jsx` | Photo, name, phone, email, DOB, nationality, gender, address, change password; work info (read-only) | employees, users, hrms_accounts |

### 4.3 Employee portal (`/employee/...`)

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `dashboard` | `employee_dashboard/Dashboard/EmployeeDashboard.jsx` | Attendance, leave, OT and holiday cards; recent requests; quick actions (3 are dead links); leave balances; announcements | aggregates (**announcements: no table**) |
| `my-leaves`, `my-leaves/apply-leave` | `MyLeaves`, `leaves/ApplyLeave.jsx` | Type and status filters. Type, From, To, Days, Status. Apply | hrms_leave_requests, hrms_leave_balances |
| `approvals` | `ApprovalInbox` | Request type, employee, dates/time, duration, level. Approve/Reject | hrms_approval_requests, _logs |
| `my-payslips` | `MyPayslips` | Credited payslips (earnings, deductions, net, PDF), YTD | hrms_payroll, hrms_payroll_items |
| `salary-approvals` | `payroll/PayrollApprovals.jsx` | Same as admin, for approvers | hrms_payroll_runs, approvals |
| `my-visa`, `visa-approvals` | `employee_dashboard/Visa/MyVisa.jsx`, `visa/VisaApprovals.jsx` | Apply/track visa and trips; approver view | hrms_exit_visas, _trips |
| `calendar`, `holiday-list` | `MyCalendar`, `Holiday` | Read-only calendar; holiday list | hrms_leave_requests, hrms_holidays |
| `my-contracts` | `newContract/MyContracts.jsx` (audience = employee) | View/sign (draw or type)/submit | hrms_contracts, _recipients, _fields |
| `loans`, `loans/:id` | `MyLoans`, `loans/LoanDetailPage.jsx` | Request a loan; EMI schedule; skip request | hrms_loans, _installments, _skip_requests |
| `profile` | `profile/Profile.jsx` | As admin | employees, users |

Pages that exist only under admin `my-requests/*`, with no `/employee/*` route: overtime, correction, documents. That's why the dashboard quick actions are dead links.

### 4.4 Staffing-company portal (`/staffing-company/...`)

| Route | Page | Fields / actions | Tables |
|---|---|---|---|
| `dashboard` | `staffingCompanyDashboard/Dashboard.jsx` | Mostly the admin dashboard markup with static names | aggregates |
| `employees` | `staffingCompanyDashboard/*` | Own workers | employees (staffing_company_id) |
| `projects`, `projects/:id` | wraps `projects/ProjectDetail.jsx` (`isStaffingCompany`) | Assigned projects and stats | hrms_staffing_company_projects, projects |
| `billing` | `staffingCompanyDashboard/*` | Bills (No, Period, Lines, Amount, Status) and annual statements | hrms_staffing_bills, hrms_year_documents |
| `contracts` | `newContract/MyContracts.jsx` (audience = staffing) | Sign contracts | hrms_contracts, _recipients |
| `profile` | `staffingCompanyDashboard/*` | Company fields, contact, password | hrms_staffing_companies, users |

---

## 5. Notes for wiring

- The mock data files say which backend shapes they mirror. These are useful contracts when building endpoints:
  - `src/data/groupD/approval.js`: `GET /approval-groups`, `/approval-groups/:id`, `/rbac/modules`, `/approval-assignments`.
  - `src/data/groupD/leaveRequests.js`: `GET /leave-requests/:id`.
  - `src/constants/permissions.js`: mirrors a backend `permission.constants.js`.
- The old README mentions `VITE_BASE_URL=http://localhost:3001/hrms/v1`. The current convention (`hrms/CLAUDE.md`) is `VITE_API_URL` pointing at `http://localhost:5000`.
- Before wiring, decide the roles/portals question (schema-review Q1). The sidebars and `useCan()` permission keys depend on it.

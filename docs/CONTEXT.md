# Domain context

Glossary of terms used in code, docs and tickets. Use these words exactly.
Decisions behind them: `docs/adr/`. Full plans: `docs/backend-plan.md`, `docs/plans/`.

| Term | Meaning |
|---|---|
| **Company** / **Tenant** | One customer organisation, a row in `employers`. All business data carries `employer_id`. Created by sign up. |
| **Partner company** | A Consultant / EPC / Sub-contractor that joins a project hierarchy. It is its own tenant with its own owner and the same Admin panel. |
| **User** / **Person** | One human identity, a row in `users`, unique by email. Holds the single password. Shared across companies over time. |
| **Account** / **Login** | A person's access to one company, a row in `hrms_accounts` (user × company). Holds the access level, role and status. |
| **Access level** | One of ADMIN, SUB_ADMIN, EMPLOYEE, GENERAL_EMPLOYEE, STAFFING_COMPANY. Decides the panel. |
| **Panel** | Admin (ADMIN, SUB_ADMIN), Employee (EMPLOYEE, GENERAL_EMPLOYEE), Staffing-company (STAFFING_COMPANY). |
| **Owner** | The company's single ADMIN, `employers.user_id`. Bypasses role permissions. Can't be deactivated, demoted or deleted. No ownership transfer yet. |
| **Role** | A company-defined permission set: module × read/create/update/delete. Assigned to an account. A new company starts with no roles. |
| **Department** / **Designation** | Labels only, no permission meaning. Designations belong to one department. |
| **Current account** | An account whose status is ACTIVE or SUSPENDED. A person may have only one current account across all companies. |
| **Ended account** | An account that is INACTIVE or soft-deleted (e.g. after an exit). Frees the email for another company. |
| **Session** | One signed-in device, a row in `hrms_sessions`, holding the hashed refresh token. |
| **Access token** | 15-minute JWT (`sub`, `acc`, `emp`, `sid`) sent as a Bearer header, kept in memory by the UI. |
| **Refresh token** | 7-day sliding, httpOnly cookie, rotated on every refresh. Reusing an old one revokes all sessions. |
| **Temporary password** | System-generated password emailed when an admin creates a login. Valid 72 h. Must be changed at first login. |
| **Setup link** | Single-use link (72 h) in the same welcome email that opens the Reset Password screen to set a password. |
| **Reset code (OTP)** | 6-digit code for forgotten passwords. 10 min, 5 attempts. Exchanged for a 15-min reset token. |
| **Lockout** | 5 consecutive wrong passwords lock the person for 15 minutes. |
| **Platform operator** | The SaaS vendor. Only one who changes company status (ACTIVE / INACTIVE / BANNED); for now directly in the database. |
| **Contract Studio** | The admin module under `/admin/new-contracts/*`: documents → templates → contracts → signing. Not the legacy `/admin/contracts/*` pages. |
| **Audience** | Who a template/contract is for: EMPLOYEE or STAFFING_COMPANY (VENDOR, CLIENT, COLLABORATING_COMPANY later). |
| **Contract document** | An uploaded PDF. Immutable: rename or archive only. |
| **Template** | A document plus placed fields and a contract type. ACTIVE or ARCHIVED. No versions. |
| **Contract type** | Company-defined category (e.g. Employment, Extension, Amendment, Staffing Agreement), set on the template. |
| **Merge field** | A DB_COLUMN field filled from a fixed catalogue (Employee, Staffing Company, Contract groups). Frozen at send. |
| **Signer** | The one recipient of a contract (PRIMARY_SIGNER): an employee or a staffing company's login. |
| **Sign-by date** | Last day the signer can sign (defaults to today + 7 when the contract is created; must still be tomorrow–90 days at send). After it, a SENT/VIEWED contract becomes EXPIRED. |
| **Active contract** | A contract in SENT, VIEWED or SUBMITTED. At most one per signer × contract type. |
| **Submit** | The signer's signing action; the contract becomes SUBMITTED. HR **approval** then makes it COMPLETED. |
| **Revoke** | HR withdraws a SENT/VIEWED/SUBMITTED contract with a reason; also done by the system when the signer leaves. |
| **Signing evidence** | Write-once record captured at submit: profile name, signature, UTC time, IP, user agent, consent, hashes. |
| **Certificate of completion** | Page appended to the final, locked PDF at COMPLETED, holding the evidence and approver. |
| **Punch** | One check-in or check-out by an employee. A check-in and its check-out make a **pair**; a day may hold many pairs. |
| **Punch window** | For work date D: from D's shift start − 4 h to D's shift end + 4 h (fixed, not a setting). |
| **Work date** | The date whose punch window holds the day's first check-in. Every check-in must fall inside that window (approved overtime extends it); a check-out may fall after it. A check-in outside every window is refused. |
| **Overtime request** | A planned start–end of extra work on one work date, raised by the employee or by an admin (one or many employees, a batch), before or after the work. Goes through the approval engine. |
| **Approved overtime** | An approved overtime request. Extends that date's punch window to its end, and makes punched time inside its start–end paid overtime. Time worked outside the shift without one is recorded but unpaid. |
| **Regular hours** | Punched time inside the shift's start–end on a work date. Time before shift start is never paid; time after shift end is paid only as approved overtime. Hourly and monthly-hourly pay follows regular hours; monthly-fixed pay doesn't drop for short hours. |
| **Day status** | One per employee per work date, first match wins: Not joined yet → Leave (full day) → Holiday / Weekly Off → Present (≥ 1 complete pair) → Incomplete (an open pair after the window closed; counts 0 h) → Absent (working day, no punches). No "late" or "half-day" status. |
| **Off-day work** | Punches on a holiday or week-off. The day keeps its H/WO status; the time is paid only as approved overtime. |
| **Unpaid day** | An Absent day of a monthly-fixed employee (Incomplete still counts as present for them). |
| **Attendance project** | The employee's main project on the work date. Every punch is tied to it; secondary projects play no part in attendance. |
| **Geofence** | The attendance project's location + radius. A check-in outside it is refused ("You are not at your project site"). |
| **Location ping** | The app's automatic position report, every 5 minutes while a pair is open. |
| **Auto check-out** | A check-out the server makes when a location ping falls outside the geofence, at that ping's time and position. No pings (app killed, no GPS) → the pair stays open and the day goes Incomplete. A manual check-out is allowed anywhere. |
| **Offline punch** | A punch or ping recorded with no network and queued on the device. Allowed only when the attendance project allows offline attendance. |
| **Sync** | Sending the offline queue on reconnect. The server replays it in order under the same rules using device times; duplicates are ignored; events in the future, older than the offline backdate limit, in a locked period or breaking a rule are rejected one by one. |
| **Attendance correction** | A request to add one start–end time block to a work date (forgot to check in/out). Pending (editable, cancellable) → Approved / Rejected. Once approved the block counts like a pair: it closes an open pair whose check-in it covers, and a day with no punches becomes Present. A block overlapping a complete pair is refused. No geofence check. |
| **Paid overtime** | Punched or approved-correction time inside an approved overtime's start–end. Nothing counts until the request is approved. On a working day overtime starts at or after shift end; on an off-day it may be any time in the window. No cap. |
| **Monthly attendance summary** | Per employee per month: regular hours, paid overtime hours, present / absent / unpaid days. What payroll reads; pending requests count for nothing. |
| **Late approval** | A correction or overtime approved after its month's payroll ran (period still unlocked). It stays on its real date and is paid as an adjustment in the next payroll. Locked periods take no new requests or approvals. |
| **Web punching** | Check-in / check-out from a browser (Employee "My Attendance", admin Attendance header for the admin's own record). Online only, same rules, location accuracy must be ≤ 100 m, pings only while the tab is open. Off unless the company turns it on. |
| **Punch source** | Where a punch came from: APP (online), OFFLINE (app, synced later), WEB, AUTO (auto check-out) or CORRECTED (approved correction). |
| **On-behalf request** | An overtime or correction raised for an employee by someone else: an account with employee create + update rights (or the owner), or an approver in that employee's approval group. Always goes through approval; the raiser can't approve it. |

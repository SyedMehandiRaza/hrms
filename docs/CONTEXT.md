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

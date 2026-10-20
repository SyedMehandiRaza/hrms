# Plan: Contract Studio

Status: **Agreed 2026-10-20** (grilling session, 30 questions; senior review, 20 issues resolved the same day).
Open questions: **0** (parked items in section 6).
Rules shared by all modules: `docs/standards.md`. Terms: `docs/CONTEXT.md`. Reasons: `docs/adr/0005`–`0009`.
Tables: the backend migrations `081`–`088` are the source of truth (UUID ids), not `hrms_schema/`.

**Parallel-work rule.** Employees / Termination is built by another developer at the same time. Contract Studio
**only reads** `employees`, `hrms_accounts`, `users`, `hrms_staffing_companies`, `projects`, departments,
designations and shifts, and references people by id. It never writes to them, never calls the Employees module's
API and never hooks into Termination. It creates **no new tables**: only additive columns/enum values on its own
eight contract tables, plus one foreign-key change on `hrms_contracts.contract_type_id` (section 1, "Schema changes").

---

## 1. Decisions

### Scope
1. HR creates contracts and sends them; the recipient reviews, then signs (submit) or rejects; HR approves.
2. **Audiences in scope: EMPLOYEE and STAFFING_COMPANY.** VENDOR, CLIENT and COLLABORATING_COMPANY cards stay
   visible in the wizard but disabled with a "Coming soon" tag; the API answers `CONTRACT_AUDIENCE_UNSUPPORTED`.
3. Employee contracts are signed in the Employee panel `/employee/my-contracts` (and the admin's own
   `/admin/my-requests/contracts`). Staffing-company contracts are signed on the staffing portal's
   `/staffing-company/contracts` page **only**; the rest of the staffing portal is not part of this module.
4. Staffing-company management (CRUD, portal login) belongs to the Staffing module. Contract Studio reads
   `hrms_staffing_companies` and `employees.staffing_company_id`; the staffing login is the company's `user_id`.
5. **Out of scope now:** separate attachments, multi-party signing (witness/approver/CC recipients, signing order),
   the Approval Groups workflow (`approval_request_id`), project-scoped access, payroll/billing from rates,
   saving signatures to profiles, DocuSign-style providers, the legacy `/admin/contracts/*` pages (stay static),
   the header notification bell.

### Documents (`new-contracts/documents`)
6. **PDF only**, ≤ 20 MB, ≤ 50 pages, **≤ 10 files per upload** (more → `CONTRACT_UPLOAD_LIMIT`, whole request).
   Type is checked by magic bytes (`%PDF-`), not the extension; the real page count is read on upload.
   Encrypted/unreadable PDFs, and PDFs containing `/JavaScript`, `/JS`, `/OpenAction`, `/AA`, `/Launch`,
   `/EmbeddedFile` or `/XFA`, are refused (`CONTRACT_DOCUMENT_INVALID`). The file's SHA-256 is stored at upload
   (`file_sha256`).
7. Documents are **immutable**: the file can never be replaced. Only rename and **archive**. Status uses the
   existing enum **SAVED | ARCHIVED** (SAVED = usable), and can be changed both ways (unarchive allowed).
   An archived document can't be used by new or edited templates — saving any template whose document is archived
   → `CONTRACT_DOCUMENT_ARCHIVED` (unarchive the document first). It stays readable for existing templates and
   contracts, and **doesn't affect sending**: an ACTIVE template on an archived document still works in the wizard.
   A document used by any template or contract can't be deleted (`CONTRACT_DOCUMENT_IN_USE`); an unused one is
   soft-deleted.
8. Contract files are **private**: stored outside the public `/uploads/` static route and served only by
   authenticated endpoints that check tenancy and visibility (404 otherwise).
   - New variable `CONTRACT_STORAGE_DIR` (default `storage/contracts`, relative to the backend folder; absolute
     used as is), added to `.env.example` only. The server refuses to start if it resolves inside `UPLOAD_DIR`.
   - `storage.service` gets a second, **private** root with the same path-escape guard and a read function.
     Nothing serves it statically.
   - Layout: `<employer_id>/documents/<uuid>.pdf`, `<employer_id>/signatures/<uuid>.png`,
     `<employer_id>/signed/<uuid>.pdf`.
   - Responses: `Content-Type: application/pdf`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
     `GET /contract-documents/:id/file` and `GET /my/contracts/:id/document` are `inline` (shown in the viewer);
     the `/pdf` downloads are `attachment` named `<number or name>.pdf`.
   - Signature images are never served on their own; they appear only stamped into the PDFs.

### Templates (`new-contracts/templates`, `new-contracts/templates/build`)
9. A template is one SAVED (not archived) PDF document + **placed fields** (page, x, y, width, height as page-relative decimals).
10. Field types: **INPUT, CHECKBOX, DATE, INITIALS, SIGNATURE** — all filled by the **signer** — and
    **DB_COLUMN** (merge field, read-only, filled by the system). There is no sender-filled field.
11. Merge fields are a **fixed catalogue in code** (section 1, "Merge-field catalogue"). A template may only use
    tokens of its own audience plus the Contract group. A template's `audience_type` must be EMPLOYEE or
    STAFFING_COMPANY on create and edit (else `CONTRACT_AUDIENCE_UNSUPPORTED`). It may change on edit, but every
    merge field must then belong to the new audience ("Unknown merge field" otherwise).
12. Saving needs: name (1–255), a SAVED (not archived) document, a **contract type** (active), ≥ 1 field and
    **≥ 1 SIGNATURE field** and **≤ 20 SIGNATURE + INITIALS fields** (keeps a signed submit under its body limit,
    decision 29). Every field must sit inside its page and on a page that exists.
    - "≥ 1 SIGNATURE" means at least one **required** SIGNATURE field.
    - Coordinates: `x, y ≥ 0`, `width, height ≥ 0.01`, `x + width ≤ 1`, `y + height ≤ 1` (else "Fields must sit
      inside the page.").
    - Label optional, ≤ 160 chars ("Label cannot exceed 160 characters"); empty → the catalogue label (DB_COLUMN)
      or the type name.
    - ≤ **200 fields** per template ("A template can have at most 200 fields").
    - `is_required` on a DB_COLUMN field decides whether `CONTRACT_FIELD_MISSING` applies.
13. Template status: **ACTIVE | ARCHIVED** (DRAFT is not used), changeable both ways. Unarchiving needs a SAVED
    document (`CONTRACT_DOCUMENT_ARCHIVED`) and an active type ("Choose a contract type"). Only ACTIVE templates
    show in the wizard.
    Templates are editable at any time; edits affect only contracts created afterwards. A template used by any
    contract can't be deleted (`CONTRACT_TEMPLATE_IN_USE`) — archive instead. Duplicate copies it as
    "<name> (copy)".
14. **No version numbers.** When a contract is created its template's fields are **copied** into
    `hrms_contract_fields` and the contract stores its own `document_id`; it never reads the template again
    (ADR 0006).

### Contract types (`/admin/contract-types`)
15. Company-defined list (name, code, description, active). Name and code unique per company, case-insensitive;
    code stored uppercase. A type used by a template or contract can't be deleted (`CONTRACT_TYPE_IN_USE`) —
    deactivate instead. An unused type is **hard-deleted** (the table has no `deleted_at`). Inactive types can't be chosen for templates; existing templates keep working.
16. The template builder's Save dialog gets a required **Contract type** dropdown. Every contract copies
    `contract_type_id` from its template at creation.
17. Seed adds **Extension (EXT)** and **Amendment (AMD)** next to the existing EMP and STAFF.

### Create & send (`new-contracts/create`)
18. Wizard: Template → Recipients → Terms → Review → **Send** or **Save as draft**.
19. **One contract per selected recipient**, each with exactly one recipient, role PRIMARY_SIGNER. The contract's
    audience is **always its template's**; `POST /contracts` takes no audience. `recipientIds` are employee ids
    for an EMPLOYEE template and staffing-company ids for a STAFFING_COMPANY template. A template whose audience is
    unsupported (only possible by direct database insert) → `CONTRACT_AUDIENCE_UNSUPPORTED`. The role
    dropdown and signing-order toggle are shown disabled ("Primary Signer", "Parallel").
20. *(Source changes after the geo + workforce merge, section 7.)* **Main project** (used for `hrms_contracts.project_id`, the `project` merge field and the lookup's project
    column) = the employee's `employee_projects` row with `main_project = 1` and `is_active = 1`; if several, the
    latest `main_project_date_start`, then latest `created_at`; one shared function. None → `project_id` NULL,
    `project` merge value empty (blocked by `CONTRACT_FIELD_MISSING` only when that field is required), blank in the
    lookup. The lookup's **project filter** matches any **active** assignment (`is_active = 1`), not only the main one.

    Recipients: the audience's own picker. Employee: filter by project and staffing company, search name/code.
    Staffing: search name/code. Max **200** recipients per request (`CONTRACT_BULK_LIMIT`).
21. **Terms** (all on `hrms_contracts`):

    | Field | Rule |
    |---|---|
    | Name | Optional, ≤ 255; default = template name |
    | Start date | Required; may be in the past |
    | End date | Optional; ≥ start; ≥ today at send |
    | Renewal due | Optional; ≥ start and ≤ end (if end given) |
    | Sign by | Required; default today + 7; from tomorrow to today + 90, re-checked at send |
    | Rate + rate unit | Optional; DECIMAL(12,2) > 0, max 2 decimals; unit HOURLY / DAILY / MONTHLY / ANNUAL, required when rate given |
    | Currency | 3-letter ISO 4217 code from a static list in code; default **SAR** |
    | Notice period | Optional integer 0–365 days |

    "Today" is the **company's timezone** date (`hrms_company_time_settings`). Dates are `DATEONLY`.
22. **Drafts.** "Save as draft" creates one DRAFT per recipient (no number). Only DRAFT can be edited
    (name + terms only; template and recipient are fixed), sent, or deleted (soft). Drafts are never visible to
    signers. The existing viewer previews a draft with live merge values.
23. **Send** (from the wizard, or a draft from the list/viewer), per contract, in its own transaction:
    1. Contract is DRAFT (or new); audience supported; template ACTIVE (wizard only; a draft keeps its own copy).
       A deactivated contract type does **not** block sending (decision 15: existing templates keep working;
       decided 2026-10-20).
    2. Recipient is active (decision 41); terms valid (decision 21).
    3. Number assigned (decision 24) and `sent_at` set, so `contract_no` and `sent_date` can be merged.
    4. **Merge values re-read now and frozen** into `hrms_contract_fields.value` (including `contract_no` and
       `sent_date`); `values_sha256` stored.
    5. Every **required** DB_COLUMN field has a value, else `CONTRACT_FIELD_MISSING` naming the missing labels.
    6. No other **active** contract of the same type for this recipient (decision 35).
    7. Status SENT; `expires_at` = end of the sign-by day in company tz (stored UTC); `project_id` = the employee's
       main project (employee audience); activity SENT; notification after commit.

    All steps run in one transaction; any block rolls back everything, including the number.
24. **Number** `CON-<FY start year>-<0001>` per company and financial year, stored in the existing
    `hrms_contracts.reference_no` (unique per company). It comes from `hrms_number_sequences`
    (`doc_type = CONTRACT`), assigned **at send**: the sequence row is created if missing with an insert that does
    nothing when it already exists, then locked `SELECT … FOR UPDATE` in the send transaction (a failed send rolls
    its number back). Counter widens past 9999. The financial year is the company's year whose dates include today
    (company tz) **and** whose status is **OPEN**; none (PLANNED, CLOSING, CLOSED or missing) →
    `CONTRACT_NO_OPEN_FY`.
25. **Bulk = partial success.** Each recipient is processed independently. Blocked recipients are kept as
    **DRAFT** with the block code/message in `meta.block`. The response lists every recipient:
    `{ contractId, recipientName, result: "SENT" | "DRAFT", code?, message? }`. The UI shows
    "N sent, M saved as draft" with the blocked names and reasons.
    - **Whole request fails, nothing written:** body/term validation (400); template not found (404), archived
      (409) or unsupported audience (400); > 200 recipients (400); in SEND mode, no open financial year (409,
      checked once before any row); **any** recipient id that isn't a record of the template's audience in this
      company → 404 `NOT_FOUND`.
    - Duplicate recipient ids are reduced to one contract each, silently.
    - **Per row:** `CONTRACT_FIELD_MISSING`, `CONTRACT_ACTIVE_EXISTS`, `CONTRACT_RECIPIENT_INACTIVE` → DRAFT with
      `meta.block`. An unexpected error rolls back only that row's transaction → result `"FAILED"`, code
      `INTERNAL_ERROR`, message "Something went wrong. Please try again.", no `contractId`; logged; the rest
      continue.
    - Response **201** `{ results: [...], sent, drafts, failed }`. The UI summary appends **"{{failed}} failed"**
      only when `failed` > 0.
    - **Single draft send** (`POST /contracts/:id/send`): blocked → that code's error (400/409), contract stays
      DRAFT, `meta.block` updated; success → 200 with the contract.
    - A successful send clears `meta.block`; each blocked attempt overwrites it.
    - Double clicks are guarded in the UI only (button disabled while the request runs). Duplicate drafts are
      harmless and deletable; duplicate sends are stopped by `CONTRACT_ACTIVE_EXISTS`.

### Signer view (Employee panel, staffing portal, admin My Requests)
26. **Visibility:** employee — contracts whose recipient `employee_id` is the caller's employee in the current
    company; staffing — STAFFING_COMPANY-audience contracts whose recipient `staffing_company_id` is the company
    whose `user_id` is the caller. Anything else → 404 on every `/my/contracts/:id…` endpoint (detail, document,
    pdf, submit, reject), with nothing written (no VIEWED, no activity) — including HR/owner with `contract:read`,
    a staffing user asking for a supplied employee's contract, and a person whose account in another company ended.
    DRAFT never visible. Contracts sent to a staffing company's supplied employees do **not** show on the staffing
    portal. An admin or sub-admin with an employee record uses My Requests with no `contract` flag; one **without**
    an employee record gets an empty list (200) and 404 on any id.
27. List: pending (SENT/VIEWED) first, oldest sent first; then the rest by latest activity. Search (name,
    number) and pagination as today.
28. **First open** by the signer of a SENT contract → VIEWED (`viewed_at` on contract and recipient, activity
    with IP/UA). Later opens and HR opens change nothing.
29. **Sign (submit):** fill fields; draw or type each SIGNATURE/INITIALS (a typed signature is pre-filled with the
    profile name, editable, 2–100 chars, no emojis; typed initials 1–10 chars, see value shapes below; drawn is a PNG data URL whose **decoded** bytes are ≤ 500 KB and start
    with the PNG magic bytes); tick the **consent** checkbox
    "I agree that my electronic signature is legally binding, the same as a handwritten signature."
    Server checks: consent (`CONTRACT_CONSENT_REQUIRED`), every required signer field filled (`VALIDATION_FAILED`
    with errors keyed by field id: "This field is required"), DATE valid. No exact name match (ADR 0005 context).
    **Value shapes** (`fields: { [fieldId]: value }`):
    - SIGNATURE / INITIALS: `{ "type": "DRAWN", "dataUrl": "…" }` or `{ "type": "TYPED", "text": "…" }`; any other
      shape → "Signature image is invalid or too large". Typed INITIALS are **1–10** chars, no emojis ("Initials must
      be 1–10 characters"); drawn initials follow the signature image rules.
    - INPUT: string, trimmed, ≤ **500** chars ("This field cannot exceed 500 characters"), no emojis.
    - CHECKBOX: `true` / `false`; a **required checkbox must be `true`** ("This field is required").
    - DATE: `YYYY-MM-DD`, a real date, any range.
    - Unknown field ids and DB_COLUMN ids in the body are **ignored** (never written). Optional fields left empty are
      stored NULL and nothing is stamped.
    **Body limit:** only this endpoint accepts JSON up to **15 MB** (20 drawn images ≈ 13.3 MB encoded); every other
    route keeps the global 1 MB. A larger body → `PAYLOAD_TOO_LARGE` (413).
30. **Reject:** "Reject" button → dialog with reason 10–500 chars, no emojis. Recipient DECLINED, contract
    REJECTED, any filled values discarded. Final — HR sends a new contract.
31. Signatures are stored **only on the contract** (`hrms_contract_fields.value` + private image file). Profile
    signature columns on `employees` / `hrms_staffing_companies` are never written. The builder toast
    "Signature captured — it will be reused from the record next time" changes (section 1, "UI copy changes").
32. **Evidence**, captured once at submit, never updated (`hrms_contract_recipients.evidence` + `signed_ip`,
    `signed_user_agent`): account id, user id, employee id or staffing company id, **profile name**, drawn image
    path(s) **with each image's SHA-256** / typed text(s), UTC timestamp, IP, user agent, consent text +
    `consent_version` ("v1"), the document's stored `file_sha256`, `values_sha256` of all field values.
    - **`values_sha256` recipe** (one shared function): SHA-256 of the UTF-8 JSON array of
      `[fieldId, fieldType, value]` sorted by field id; value = the stored text, or for a drawn signature its image
      SHA-256. At send it covers merge values only (`hrms_contracts.values_sha256`); at submit, all values.
    - **IP:** `req.ip`, with `app.set('trust proxy', TRUST_PROXY)` (new variable, hop count, default unset, added
      to `.env.example`). This also corrects the existing rate limiter behind a proxy.
    - **Integrity checks:** every render (preview or final) and every download first compares the document file,
      each signature image and the final PDF with their stored SHA-256. A mismatch → 500 `INTERNAL_ERROR`, logged
      as "contract file integrity check failed"; nothing is produced or served.

### Status rules
33. Flow:
    ```
    DRAFT ─send→ SENT ─signer opens→ VIEWED
    SENT|VIEWED ─submit→ SUBMITTED ─HR approve→ COMPLETED
    SENT|VIEWED ─reject→ REJECTED
    SENT|VIEWED ─sign-by passes→ EXPIRED
    SENT|VIEWED|SUBMITTED ─HR revoke (reason) or recipient inactive→ REVOKED
    ```
    End states REJECTED, EXPIRED, REVOKED, COMPLETED never change. The enum value APPROVED stays but is unused.
34. **Approve** = one click by `contract:update` (ADR 0007); SUBMITTED → COMPLETED, `approved_by/at`,
    `completed_at`; final PDF generated in the same request (decision 38); if PDF generation fails nothing is
    committed. Approving a contract whose recipient is the approver's own employee → `CONTRACT_SELF_APPROVAL`
    (403), even for ADMIN.
35. **One active contract per recipient × type.** Active = SENT, VIEWED, SUBMITTED. Enforced by a generated
    `active_key` column with a unique index (section 1, "Schema changes"), so concurrent sends can't both succeed
    → `CONTRACT_ACTIVE_EXISTS` naming the active contract's number. No overlap check against COMPLETED contracts.
36. **Expiry:** at the end of the sign-by day in company tz. An **hourly job** (`node-cron`) moves SENT/VIEWED past
    `expires_at` to EXPIRED (actor = system) and notifies. SUBMITTED never expires. Expired contracts aren't
    resent. The job's updates are conditional, so running it twice (several instances) is harmless.
    **Lazy expiry writes:** one shared function expires due SENT/VIEWED contracts (same conditional update,
    EXPIRED activity, notifications). The job calls it for all companies; **every contract endpoint** (HR list,
    stats, detail and actions; signer list, detail and actions) calls it for the caller's company first. Stored
    status is therefore always true, and no screen offers Sign on a contract that is past its sign-by time.
37. **Race safety:** every transition is a conditional `UPDATE … WHERE status IN (…) [AND expires_at > now]` in
    one transaction; 0 rows → nothing else is written and the API answers from the current state (below). The UI
    disables action buttons while a request runs and reloads the contract after any 409.

    **Signer submit / reject**, checked in this order (first match wins):
    1. Not visible to the caller → 404 `NOT_FOUND`.
    2. SUBMITTED or COMPLETED → `CONTRACT_ALREADY_SIGNED`.
    3. REJECTED → `CONTRACT_STATUS_INVALID`.
    4. REVOKED → `CONTRACT_REVOKED`.
    5. EXPIRED, or SENT/VIEWED with `expires_at` ≤ now → `CONTRACT_EXPIRED`.
    6. Recipient inactive (decision 41) → `CONTRACT_RECIPIENT_INACTIVE`.
    7. Then body checks: consent (`CONTRACT_CONSENT_REQUIRED`), then field validation (`VALIDATION_FAILED`).

    **HR actions** (edit, delete, send, approve, revoke): wrong state for the action → `CONTRACT_STATUS_INVALID`;
    then self-approval (approve only), then recipient inactive; then body validation.

    **Specific races:**
    - **VIEWED:** conditional `UPDATE … WHERE status = 'SENT'`; the VIEWED activity and `viewed_at` are written only
      when it changed one row (two tabs opening at once → one activity).
    - **Draft send / edit / delete:** each starts with `SELECT … FOR UPDATE` on the contract and re-checks DRAFT and
      not deleted. The later one waits, then gets `CONTRACT_STATUS_INVALID` (or 404 if the draft was deleted).
    - **Files (submit's signature images, approve's final PDF):** (1) lock the row and check state — a second
      approval stops here before rendering; (2) render and write each file under a **new UUID name**; (3) update and
      commit; (4) if anything after the write fails, delete the files written (best effort, logged), respond 500,
      nothing committed. No file is ever overwritten.

### PDF
38. **Final PDF** at COMPLETED, with `pdf-lib`: the original PDF with every value and signature stamped in place
    and flattened (including any form fields the original already had), plus an appended **Certificate of completion** page (English): contract number, type, template
    PDF SHA-256, signer evidence (decision 32), approver name and time (UTC and company tz). Stored once
    (private), `signed_pdf_sha256` saved on the contract; never regenerated or overwritten.
39. Before COMPLETED, downloads (HR and signer) are generated on the fly: values filled, **no** certificate page,
    diagonal watermark **"Not final"**. Drafts preview with live values; SENT onward with frozen values.
40. **Arabic:** embed Noto Sans + Noto Naskh Arabic (bundled with the backend, OFL); every value goes through an
    Arabic reshaper + the bidi algorithm before drawing; font chosen per script (ADR 0009). Values are
    shrunk-to-fit inside their field box (min 6 pt), never overflow.

### Recipients leaving
41. A recipient is **inactive** when: employee EXITED or soft-deleted, or their account in this company isn't
    current; staffing company INACTIVE, soft-deleted, has no `user_id`, or that user has no **current**
    STAFFING_COMPANY account in this company (missing, INACTIVE or soft-deleted). **IN_NOTICE is still active**;
    a SUSPENDED account is still current (CONTEXT) for both audiences.
    - At send → that contract blocked with `CONTRACT_RECIPIENT_INACTIVE`.
    - Pending (SENT/VIEWED/SUBMITTED) → the hourly job auto-revokes: reason "Recipient is no longer active.",
      actor system, creator notified (signer not).
    - Sign/reject/approve on an inactive recipient → `CONTRACT_RECIPIENT_INACTIVE`, even before the job runs.
    - COMPLETED contracts are never touched. Later changes to employee or staffing data never change a sent
      contract (values are frozen).

### Audit
42. `hrms_contract_activities`, **append-only** (no update/delete API), shown to HR only in the viewer:

    | Action | When | Actor | meta |
    |---|---|---|---|
    | CREATED | draft/contract created | HR user | template id, type id |
    | UPDATED | draft name/terms edited | HR user | changed fields old → new |
    | SENT | sent | HR user | number, values_sha256, expires_at |
    | VIEWED | first signer open | signer | ip, user agent |
    | SIGNED | submit | signer | evidence summary |
    | DECLINED | reject | signer | reason |
    | COMPLETED | approve | HR user | signed_pdf_sha256 |
    | REVOKED | revoke / auto-revoke | HR user / system | reason |
    | EXPIRED | job or lazy expiry (decision 36) | system | — |
    | REMINDED | expiring-soon notice | system | — |

    Deleted drafts keep their rows. Downloads and template/document changes are not logged.

### Notifications
43. In-app rows in `notifications` (`entity_type = "contract"`) **and** email through the mailer, in the
    receiver's `users.lang_key`. Email holds a link to the page, never the PDF or values. Sent **after commit**;
    failures are logged and never roll back the action. Displaying rows (header bell) is the Notifications
    module's job.

    | Event | Receiver |
    |---|---|
    | Sent | signer (employee's user / staffing company's user) |
    | Signed | contract creator |
    | Rejected (with reason) | creator |
    | Expiring in 2 days (once; `reminder_sent_at` + REMINDED) | signer |
    | Expired | creator and signer |
    | Revoked (with reason) | signer (HR revoke only) / creator (auto-revoke only) |
    | Completed | signer |

    Creator has no current account → no notice (the activity still records it).

    **Text (EN; AR drafted and marked for native review).** `notifications.type` = the type below; email subject =
    title; email body = body + an **"Open contract"** button. Dates `DD MMM YYYY`.

    | Type | Receiver | Title | Body |
    |---|---|---|---|
    | `CONTRACT_SENT` | signer | New contract to sign | {{name}} ({{number}}) is waiting for your signature. Sign by {{signBy}}. |
    | `CONTRACT_SIGNED` | creator | Contract signed | {{recipient}} signed {{name}} ({{number}}). It's ready for your approval. |
    | `CONTRACT_REJECTED` | creator | Contract rejected | {{recipient}} rejected {{name}} ({{number}}): {{reason}} |
    | `CONTRACT_EXPIRING` | signer | Contract expires soon | {{name}} ({{number}}) must be signed by {{signBy}}. |
    | `CONTRACT_EXPIRED` | creator + signer | Contract expired | {{name}} ({{number}}) wasn't signed by {{signBy}} and has expired. |
    | `CONTRACT_REVOKED` | signer (HR revoke) | Contract withdrawn | {{name}} ({{number}}) was withdrawn by HR: {{reason}} |
    | `CONTRACT_REVOKED` | creator (auto-revoke) | Contract withdrawn | {{name}} ({{number}}) was withdrawn because {{recipient}} is no longer active. |
    | `CONTRACT_COMPLETED` | signer | Contract completed | {{name}} ({{number}}) has been approved. You can download the final PDF. |

    **Links:** `APP_URL` + path + `?contract=<id>`, by the receiver's access level: EMPLOYEE / GENERAL_EMPLOYEE →
    `/employee/my-contracts`; ADMIN / SUB_ADMIN signer → `/admin/my-requests/contracts`; STAFFING_COMPANY →
    `/staffing-company/contracts`; creator → `/admin/new-contracts`. Those pages open the contract when
    `?contract=` is present.

    **Reminder** (job, once): status SENT/VIEWED, `reminder_sent_at` NULL, 0 < `expires_at` − now ≤ 48 h, **and**
    `expires_at` − `sent_at` > 48 h (short-deadline contracts get no reminder).

### Merge-field catalogue (fixed in code)
44. *(Nationality, residence, phones, `employee_code` and staffing `city` change after the geo + workforce merge,
    section 7.)* Values are frozen **once, in English formats**, whatever the sender's or signer's language; free text (names,
    addresses, nationality) is used **as stored** (Arabic included). Empty → missing.
    - Dates `DD MMM YYYY`, English month abbreviations (e.g. "16 Jan 2023").
    - Enums: fixed English label map; each word capitalised, `_` → space (`IN_NOTICE` → "In Notice",
      `FULL_TIME` → "Full Time", `MALE` → "Male").
    - Rate: `<CUR> <amount, thousands commas, 2 decimals> / hour|day|month|year` (e.g. "SAR 4,500.00 / month",
      "SAR 120.50 / hour").
    - Notice period: "1 day", "30 days", "0 days".

    | Group | Token → source |
    |---|---|
    | Employee | `employee_name` full_name · `employee_email` users.email · `employee_phone` users.phone_number · `employee_code` employees.country_emp_id · `designation` · `department` · `project` (main project name) · `staffing_company` (blank on company payroll) · `joining_date` · `employment_type` · `nationality` · `gender` · `dob` · `address` · `shift` · `company_name` (employer) |
    | Staffing Company | `company_name` · `company_code` · `company_email` · `company_phone` · `contact_person_name` · `contact_person_email` · `contact_person_phone` · `city` · `address` · `employer_name` |
    | Contract | `contract_no` · `contract_type` · `start_date` · `end_date` · `rate` · `notice_period` ("30 days") · `sent_date` |

    Stored as `db_source` (EMPLOYEE / STAFFING_COMPANY / CONTRACT) + `db_column` (token). The UI's `employee_id`,
    `job_title` and `salary` tokens are replaced by `employee_code`, `designation` and nothing (no salary
    auto-field; salary belongs to Employees). `GET /contract-merge-fields?audience=` serves the catalogue.

### UI copy changes (approved)
45. - Documents: input `accept=".pdf"`; drop the "DOCX" chip; drop title "Drop PDF or DOCX files to upload" →
      "Drop PDF files to upload"; max-size chip stays "MAX 20MB".
    - Wizard: Vendor / Client / Collaborator cards disabled with **"Coming soon"**; role dropdown and
      signing-order toggle disabled; Terms step adds **Sign by**, **Rate**, **Rate unit**, **Currency**,
      **Notice period (days)**; Review step adds **"Save as draft"**; send result summary
      **"{{sent}} sent, {{drafts}} saved as draft"** (+ **", {{failed}} failed"** when > 0) with the blocked list.
    - Builder: Save dialog adds required **Contract type**; field palette's Date and Initials are real types;
      toast "Signature captured — it will be reused from the record next time" → **"Signature captured"**.
    - Viewer (signer): consent checkbox above Submit; **Reject** button + reason dialog.
    - Viewer (HR): **Revoke** button + reason dialog (SENT/VIEWED/SUBMITTED); **Send** and **Edit** on drafts.
    - Success toasts: **"Contract revoked"** (HR revoke), **"Contract rejected"** (signer reject), **"Draft updated"**
      (draft edit), **"Draft deleted"** (draft delete).
    - New EN + AR strings for all of the above (AR marked for native review).

### Schema changes needed (migrations, contract tables only)
46. - `hrms_contracts`: status enum **+ REVOKED**; + `revoke_reason VARCHAR(500)`, `revoked_at DATETIME`,
      `revoked_by UUID →users SET NULL`; + `rate DECIMAL(12,2)`, `rate_unit ENUM(HOURLY,DAILY,MONTHLY,ANNUAL)`,
      `currency CHAR(3) DEFAULT 'SAR'`, `notice_period_days INT`; + `recipient_key VARCHAR(40)`
      (`E:<employee_id>` / `S:<staffing_company_id>`, set at creation); + generated
      `active_key VARCHAR(80) GENERATED ALWAYS AS (IF(status IN ('SENT','VIEWED','SUBMITTED') AND deleted_at IS NULL,
      CONCAT(contract_type_id,'|',recipient_key), NULL)) STORED` with unique `(employer_id, active_key)`;
      `contract_type_id` foreign key changed from `ON DELETE SET NULL` to **`ON DELETE RESTRICT`** (MySQL refuses a
      STORED generated column over a SET NULL foreign key; types in use can't be deleted anyway, decision 15). The API
      always copies the type from the template, so a contract never has a NULL type;
      + `values_sha256 CHAR(64)`, `signed_pdf_path VARCHAR(512)`, `signed_pdf_sha256 CHAR(64)`,
      `reminder_sent_at DATETIME`; index `(status, expires_at)` for the job.
    - `hrms_contract_documents`: + `file_sha256 CHAR(64)`.
    - `hrms_contract_templates`: + `contract_type_id UUID →hrms_contract_types RESTRICT`, **nullable** in the
      database (required by the API, decision 12). The migration backfills existing templates with the same
      company's EMP type (EMPLOYEE audience) or STAFF type (STAFFING_COMPANY audience) when one exists; a template
      still without a type can't be used in the wizard until it is edited: creating drafts or sending from it →
      `CONTRACT_TEMPLATE_INACTIVE` (decided 2026-10-20).
    - `hrms_contract_template_fields`, `hrms_contract_fields`: `field_type` **+ DATE, INITIALS**;
      `db_source` **+ CONTRACT**.
    - `hrms_contract_recipients`: `reject_reason` → VARCHAR(500); + `signed_ip VARCHAR(64)`,
      `signed_user_agent VARCHAR(255)`, `evidence JSON`.
    - `hrms_contract_activities`: `action` **+ REVOKED**.
    - `hrms_contract_types`: + unique `(employer_id, name)`.
    - No changes to any non-contract table. Models: add the new attributes; generated `active_key` is never written.

### Endpoints
| Method & path | Who |
|---|---|
| `GET /contract-types` · `POST` · `PUT /contract-types/:id` · `DELETE /contract-types/:id` | `contract:read/create/update/delete` |
| `GET /contract-documents` · `POST` (multipart `files[]`) · `PATCH /:id` (name, status) · `DELETE /:id` · `GET /:id/file` | `contract:*` |
| `GET /contract-templates` · `POST` · `GET/PUT/DELETE /:id` · `POST /:id/duplicate` · `PATCH /:id/status` | `contract:*` |
| `GET /contract-merge-fields?audience=` | `contract:read` |
| `GET /contract-recipients?audience=&projectId=&staffingCompanyId=&q=` (id, name, code, project, staffing co, status) | `contract:create` |
| `GET /contracts` (status, audience, type, q, page) · `GET /contracts/stats` · `GET /contracts/:id` (recipient, fields, activity) | `contract:read` |
| `POST /contracts` `{ mode: "DRAFT"\|"SEND", templateId, recipientIds[], name?, terms }` → per-recipient results | `contract:create` |
| `PUT /contracts/:id` (draft name/terms) | `contract:update` |
| `DELETE /contracts/:id` (draft) | `contract:delete` |
| `POST /contracts/:id/send` | `contract:create` |
| `POST /contracts/:id/approve` · `POST /contracts/:id/revoke` `{ reason }` | `contract:update` |
| `GET /contracts/:id/pdf` | `contract:read` |
| `GET /my/contracts` · `GET /my/contracts/:id` (marks VIEWED) · `GET /my/contracts/:id/pdf` (download) · `GET /my/contracts/:id/document` (original PDF bytes, for rendering pages under the fillable fields) | the signer (any panel) |
| `POST /my/contracts/:id/submit` `{ fields: { [fieldId]: value }, consent: true }` · `POST /my/contracts/:id/reject` `{ reason }` | the signer |

Every admin endpoint is scoped by the token's `employer_id`; another company's record → 404.

---

## 2. Permission matrix

One permission module: `contract`. ADMIN (owner) bypasses role flags (but not self-approval).

| Action | ADMIN | SUB_ADMIN / EMPLOYEE / GENERAL_EMPLOYEE | STAFFING_COMPANY |
|---|---|---|---|
| Studio dashboard, contracts list, viewer, activity, downloads; documents, templates, types lists | ✅ | `contract:read` | ❌ |
| Upload documents, build templates, create types, save drafts, **send** | ✅ | `contract:create` | ❌ |
| Edit drafts; edit/archive templates, documents, types; **revoke**; **approve** | ✅ | `contract:update` | ❌ |
| Delete drafts; delete unused documents, templates, types | ✅ | `contract:delete` | ❌ |
| Recipient lookup | ✅ | `contract:create` | ❌ |
| View / sign / reject / download **own** contracts | ✅ (My Requests) | ✅ (no flag needed) | ✅ own company's (no flag needed) |
| Approve a contract you are the signer of | ❌ | ❌ | ❌ |

`contract:read` sees **all** company contracts (no project scoping). The admin sidebar hides Contract Studio items
without `contract:read`; buttons are hidden by flag; the server enforces everything.

---

## 3. Messages
All codes and exact texts: `docs/standards.md` §7 (Contract Studio rows added 2026-10-20).

---

## 4. User flows

**Contract Types `/admin/contract-types`**
- Happy: list (search, active filter) → Create/Edit modal → save → toast → Delete unused → confirm → removed.
- Errors: field errors · `CONTRACT_TYPE_NAME_TAKEN` / `CONTRACT_TYPE_CODE_TAKEN` · `CONTRACT_TYPE_IN_USE` ·
  `FORBIDDEN` · empty / error states.

**Documents `/admin/new-contracts/documents`**
- Happy: drop or browse PDFs → each saved with real page count and size → appears in library → rename / archive →
  delete unused → "Make Template" opens the builder with it.
- Errors: `CONTRACT_DOCUMENT_INVALID` per bad file (others still saved) · `CONTRACT_DOCUMENT_IN_USE` · `FORBIDDEN`.

**Templates + builder `/admin/new-contracts/templates`, `/templates/build`**
- Happy: pick a saved (not archived) document → drag fields and merge fields onto pages → set labels/required → Save (name,
  contract type) → listed as ACTIVE → edit / duplicate / archive / delete unused.
- Errors: "Give the template a name." · "Select a source document first." · "Add at least one field or column." ·
  "Add at least one signature field." · "Choose a contract type" · `CONTRACT_DOCUMENT_ARCHIVED` ·
  `CONTRACT_TEMPLATE_IN_USE` · `FORBIDDEN`.

**Send wizard `/admin/new-contracts/create`**
- Happy: Employee or Staffing audience → template → recipients (filters, search, multi-select) → terms →
  review → Send → "N sent, M saved as draft" → contracts list. Or "Save as draft" → Drafts tab.
- Errors: "Pick a template to continue." · "Select at least one recipient." · term field errors ·
  `CONTRACT_BULK_LIMIT` · per-recipient `CONTRACT_FIELD_MISSING` / `CONTRACT_ACTIVE_EXISTS` /
  `CONTRACT_RECIPIENT_INACTIVE` (saved as draft) · `CONTRACT_NO_OPEN_FY` · `CONTRACT_TEMPLATE_INACTIVE`.

**Contracts list + HR viewer `/admin/new-contracts`, dashboard**
- Happy: stats by status/audience; tabs by status; search; open → PDF with values, recipient status, activity.
  Draft: Edit terms, Send, Delete. SENT/VIEWED/SUBMITTED: Revoke with reason. SUBMITTED: Approve → COMPLETED →
  download final PDF.
- Errors: `CONTRACT_STATUS_INVALID` (any wrong state, including expired or revoked) · `CONTRACT_SELF_APPROVAL` ·
  `CONTRACT_RECIPIENT_INACTIVE` · reason field errors · `NOT_FOUND` · `FORBIDDEN`.

**My Contracts (employee `/employee/my-contracts`, admin `/admin/my-requests/contracts`, staffing
`/staffing-company/contracts`)**
- Happy: pending first → open (→ VIEWED) → fill fields → sign (draw/type) → tick consent → Submit →
  "Signed & submitted" → status Submitted → later Completed → download final PDF.
  Or Reject → reason → status Rejected.
- Errors: required fields left ("{{count}} required field(s) still need completing.") ·
  `CONTRACT_CONSENT_REQUIRED` · `CONTRACT_ALREADY_SIGNED` · `CONTRACT_EXPIRED` · `CONTRACT_REVOKED` ·
  `CONTRACT_STATUS_INVALID` · `CONTRACT_RECIPIENT_INACTIVE` · reason field errors · someone else's → `NOT_FOUND`.

---

## 5. Test data
The shared `20261019100010-activity.js` seeder is **not edited** (it is shared with other modules). A new
contract seeder (`…100011-contracts.js`, ticket 01) adds types EXT and AMD and **updates** the existing seeded
document and template; its `down` reverts only what it changed.
- A small sample PDF (2–3 pages, no scripts) is committed under the backend's seed assets; the seeder copies it
  into `CONTRACT_STORAGE_DIR` and sets `file_path`, `file_sha256`, `page_count` and size.
- One ACTIVE employee template (type EMP; a required SIGNATURE, a DATE and `employee_name`/`designation` merge
  fields) and one ACTIVE staffing template (type STAFF).
- **Demo contracts** (ticket 25, after approve exists): for `employee@hrms.test` in SENT, SUBMITTED and COMPLETED,
  and one SENT to the seeded staffing company, created through the real services so evidence, hashes and the final
  PDF are genuine. Dates are relative to the seed run (sign-by = today + 7).

Every module test suite adds a second company to prove isolation (standards §3).

---

## 6. Parked (later, not open)
- Separate attachments; multi-party signing; Approval Groups for contracts; "Duplicate as draft" on
  rejected/expired contracts; non-blocking overlap warning vs. COMPLETED contracts.
- Vendor, Client, Collaborator audiences (need tables / external signing links / cross-tenant rules).
- Saving and reusing profile signatures (needs the Employees module to own those columns).
- Project-scoped contract access for managers.
- Arabic certificate page.
- Arabic merge-value formats per template (dates, enums, rate in Arabic).
- Retire or redirect the legacy `/admin/contracts/*` pages.

---

## 7. After geo merge

The **geo + workforce** branch (`hrms-project-moduleA`, not merged yet) changes employee, staffing-company and company
data that Contract Studio reads. Its plans: `docs/plans/countries-cities-phones.md` and
`docs/plans/workforce-and-lifecycle.md` (employee fields D45, D55). Its ADRs will be numbered **0010–0012**; ours
stay 0005–0009. Until the merge, everything above applies unchanged. After the merge, ticket 26 applies this
section, which **overrides** decisions 20 (main project) and 44 (free-text nationality) and the catalogue table
for the tokens below. Contract Studio still only **reads** these tables (ADR 0008) and adds no schema changes.

### What changes in the other branch
- `employees.nationality` (text) → `nationality_country_id` → `countries` (text column kept until dropped).
- New `employees.residence_country_id` (required) and `residence_city_id` (optional).
- Every phone stored as **E.164** (`+966501234567`) plus a phone country (`iso2`): `users.phone_number`,
  `employees.phone`, `hrms_staffing_companies.phone` and `contact_person_phone`, `employers.company_phone_number`.
  Legacy values that couldn't be parsed stay as they were, with phone country NULL.
- `employers.country_id` (Saudi Arabia for every company).
- `countries` and `cities` have English and Arabic names (Arabic falls back to English when missing).
- `hrms_staffing_companies` gets `country_id`, `city_id`; the text `city` is migrated where it matches and kept.
- `employees.employee_code` is new and server-generated (`EMP-0001`); `country_emp_id` is the Iqama / national ID.
- Main project history moves to `hrms_employee_main_project_periods` (`date_from`, `date_to`).

### Contract Studio parts that use these fields
| Part | Uses today | After the merge |
|---|---|---|
| Merge field `nationality` (Employee) | `employees.nationality` text, as stored | Country name from `nationality_country_id`, EN or AR (rule below) |
| Merge field `employee_phone` (Employee) | `users.phone_number` as stored | Formatted from E.164 (rule below) |
| Merge fields `residence_country`, `residence_city` (Employee) | — | **New** tokens, names EN or AR (rule below) |
| Merge field `employee_code` (Employee) | `employees.country_emp_id` | `employees.employee_code` (EMP-0001) |
| Merge field `id_number` (Employee) | — | **New** token, `employees.country_emp_id` (Iqama / national ID) |
| Merge field `project` + `hrms_contracts.project_id` (decision 20) | `employee_projects.main_project` flag | Main-project period covering today |
| Merge fields `company_phone`, `contact_person_phone` (Staffing Company) | stored text | Formatted from E.164 (rule below) |
| Merge field `city` (Staffing Company) | text `city` | City name from `city_id`, EN or AR; falls back to the text column when `city_id` is empty |
| Recipient lookup (decision 20, ticket 06) | code = `country_emp_id`; staffing city not shown | Shows and searches `employee_code` **and** `id_number`; shows nationality, residence country and residence city; staffing shows city. Names in the request language (geo D10) |
| PDF values (decision 40, ticket 11) | mostly Latin | Country and city names may be Arabic in an English template; phones in international format contain `+` and spaces. Both go through the same reshaper + bidi path; covered by tests |
| Seeds (section 5, tickets 01, 25) | seeded templates use `employee_name`, `designation` | No change needed; the geo branch migrates seeded employees. Demo contracts (ticket 25) are re-created by re-seeding |
| Tests (tickets 06, 08, 11, 22) | employee fixtures with text nationality, 6–15 digit phones, flag-based main project | Fixtures use country ids, E.164 phones with phone country, main-project periods; assertions updated to the rules below |

Addresses (`address` tokens), names, designation, department, shift and the Contract group are not affected.

### Rules after the merge
- **Language of country and city names:** the **signer's `users.lang_key` at send** (`ar` → Arabic name, falling
  back to English when it has none; anything else → English). The name is frozen at send like every other value.
  Dates, enums and rate keep the English formats of decision 44 (Arabic formats stay parked). The draft preview uses
  the same rule with the signer's current `lang_key`.
- **Phone format:** parsed from E.164 with `libphonenumber-js`. Phone country = the company's country
  (`employers.country_id`) → **national** format (`050 123 4567`); any other phone country → **international**
  format (`+91 98765 43210`). A legacy value with phone country NULL is used as stored. Empty → missing.
- **Main project:** the employee's `hrms_employee_main_project_periods` row with `date_from` ≤ today (company tz)
  and `date_to` empty or ≥ today. None → as decision 20 (no project). Replaces the flag rule of decision 20.
- **`employee_code` / `id_number`:** on the merge, existing **template fields and draft contract fields** whose
  `db_column` is `employee_code` are rewritten to `id_number` (one data migration on contract tables), so a
  template keeps showing the Iqama / ID it was built with. Sent contracts are frozen and never change.

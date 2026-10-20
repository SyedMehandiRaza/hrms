# 09: Signer inbox API

**What to build:** My Contracts list and detail for employees, the admin's own contracts and staffing companies,
with VIEWED on first open, and preview and final downloads (plan decisions 26–28, 39).

**Blocked by:** 08 Send contracts (single and bulk), 11 PDF rendering service

**Status:** done

- [x] When the employee lists My Contracts → only contracts addressed to their own employee record in the current
      company: SENT and VIEWED first (oldest sent first), then the rest by latest activity; search by name or number;
      pagination.
- [x] When the owner lists My Requests → Contracts → only contracts addressed to the owner's own employee record.
- [x] When the staffing company lists its contracts → only Staffing Company contracts addressed to it, and none of
      the contracts sent to its supplied employees.
- [x] When the employee opens a draft, another employee's contract, or a contract in another company → 404 /
      "The requested record was not found."
- [x] When any of these asks for a contract's detail, document or PDF → 404 / "The requested record was not found."
      and nothing changes (no VIEWED, no activity): another employee; the employee asking for a staffing contract;
      the staffing company asking for a supplied employee's contract; HR with `contract:read` or the owner when it
      isn't addressed to them; a person whose account in the contract's company has ended and who is now logged in
      to another company.
- [x] When a sub-admin with an employee record and no role lists My Requests → Contracts → their own contracts.
- [x] When an admin or sub-admin without an employee record lists My Contracts → an empty list; opening any id → 404.
- [x] When the employee opens a SENT contract for the first time → it becomes VIEWED, with time, IP and user agent
      in a VIEWED activity.
- [x] When the employee opens it again, or HR opens it → nothing changes.
- [x] When the employee opens a SENT contract in two tabs at the same moment → it is VIEWED with exactly one VIEWED
      activity.
- [x] When a SENT or VIEWED contract is past its sign-by time and the job hasn't run → the list and detail show it
      as EXPIRED, with one EXPIRED activity, for both the signer and HR.
- [x] When the employee asks for the contract's original document → the original PDF bytes, without values or
      watermark; when another signer, or anyone for a draft, asks → 404 / "The requested record was not found."
- [x] When the employee downloads → the file comes as an attachment named after the contract number (or name), with
      no-store caching.
- [x] When the employee downloads before completion → the PDF with frozen values and a "Not final" watermark.
- [x] When the employee downloads a COMPLETED contract → the stored final PDF, whose SHA-256 matches the hash
      stored on the contract; when the stored file no longer matches → 500 / "Something went wrong. Please try
      again." and the integrity failure is logged.
- [x] When a GENERAL_EMPLOYEE with no role uses My Contracts → allowed (no permission flag needed).
- [x] When the response is built → it never includes the activity log or other recipients' data.

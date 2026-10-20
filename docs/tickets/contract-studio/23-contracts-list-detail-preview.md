# 23: Contracts list, detail, stats and preview

**What to build:** HR list with filters and search, contract detail with recipient, fields and activity, stats for
the dashboard, and the HR PDF download (live preview for drafts, frozen preview before completion, stored final
PDF after) (plan decisions 22, 36, 39, 42).

**Blocked by:** 07 Drafts API, 11 PDF rendering service, 22 Merge values

**Status:** done

- [x] When HR lists contracts → filters by status, audience and type; search by name or number; pagination.
- [x] When HR asks for stats → counts by status and by audience match the data.
- [x] When HR opens a contract → its recipient, fields and activity (newest first).
- [x] When a SENT or VIEWED contract is past its sign-by time and the job hasn't run → the list, stats and detail
      show it as EXPIRED, with one EXPIRED activity.
- [x] When HR downloads a draft → the PDF with live merge values and a "Not final" watermark.
- [x] When HR downloads a SENT, VIEWED or SUBMITTED contract → the PDF with frozen values and a "Not final"
      watermark.
- [x] When HR downloads a COMPLETED contract → the stored final PDF.
- [x] When HR downloads → an attachment named after the contract number (or name), with no-store caching.
- [x] When deleted drafts exist → they aren't listed or counted.
- [x] When HR opens or downloads another company's contract → 404 / "The requested record was not found."
- [x] When a sub-admin without `contract:read`, the employee or the staffing company calls these → 403 / "You
      don't have permission to do this."

# 5. Contract templates are PDFs with placed fields, uploaded as PDF only

Date: 2026-10-20 · Status: Accepted

## Context
The brief asked for rich-text templates with `{{placeholders}}`. The finished Contract Studio UI and the schema
instead upload a document and drag Input / Checkbox / Date / Initials / Signature / DB-column fields onto page
positions (`hrms_contract_template_fields`). CLAUDE.md forbids design changes. The upload screen also accepted DOCX,
but placing fields needs rendered pages, so DOCX would need a server-side converter (headless LibreOffice) whose
output can shift layout.

## Decision
- Keep the PDF + placed-fields model. The placeholder list becomes the fixed DB_COLUMN merge-field catalogue.
- Uploads are **PDF only** (magic-byte check), ≤ 20 MB, ≤ 50 pages. HR exports DOCX to PDF themselves.
- Identity of a signer comes from the authenticated session; typed signatures are not required to match the
  profile name exactly (scripts and spellings differ). The profile name is recorded in the evidence instead.

## Consequences
- No editor, no new tables, no converter dependency.
- Small copy change on the Documents screen (accept `.pdf`, no DOCX chip).
- Contract text is whatever is in the PDF; only field values vary per contract.

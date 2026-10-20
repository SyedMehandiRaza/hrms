# 6. Contracts snapshot their template instead of template versions

Date: 2026-10-20 · Status: Accepted

## Context
Contracts must keep what was sent even if the template or the employee's data change later. The brief proposed
versioned templates. The schema has no version column, but each contract already has its own `document_id` and its
own copy of fields (`hrms_contract_fields`).

## Decision
- On creation a contract copies every template field; it never reads the template again.
- Merge values are re-read and frozen at **send** (drafts preview live values). `values_sha256` is stored.
- Documents are immutable (rename/archive only), so the copied `document_id` always points at the same bytes.
- Templates stay freely editable; edits affect only contracts created afterwards.

## Consequences
- No version table or version UI.
- A template used by contracts can't be deleted, only archived; a used document can't be deleted.

# 4. Errors carry a stable code and a localized message

Date: 2026-10-19 · Status: Accepted

## Context
`backend/CLAUDE.md` fixed errors as `{ success: false, message }`. The UI is English/Arabic, shows the
server `message` exactly, and `applyFieldErrors.js` expects a per-field `errors` map.

## Decision
- Shape: `{ success: false, code, message, errors? }`.
- `message` is translated from `Accept-Language` (`en` | `ar`, default `en`).
- `errors` appears only on validation failures (400).
- One catalog in `backend/src/constants/messages.js`. Field messages reuse the UI's i18n strings.

## Consequences
- Backwards compatible with the old shape (fields only added).
- Tests assert on `code` instead of wording.
- Every new message needs EN and AR text.

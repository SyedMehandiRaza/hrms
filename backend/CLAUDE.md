# Backend rules

## Stack
Express, Sequelize + sequelize-cli (MySQL 8, driver mysql2), Joi, JWT (access + refresh), bcrypt,
Jest + supertest, ESLint, nodemon.

## Folder structure
```
backend/
├── src/
│   ├── app.js              # express app (no listen) — used by tests
│   ├── server.js           # app.listen
│   ├── config/             # db config, env loading
│   ├── routes/             # one router per module, mounted in routes/index.js
│   ├── validations/        # Joi schemas per module
│   ├── controllers/        # thin: read req, call service, send response
│   ├── services/           # business logic
│   ├── models/             # Sequelize models
│   ├── middlewares/        # requireAuth, requirePermission, requireAccessLevel, validate, errorHandler
│   ├── migrations/         # sequelize-cli migrations (paths set in .sequelizerc)
│   ├── seeders/            # sequelize-cli seeders (dev data)
│   └── utils/ErrorHandler.js
└── tests/                  # <module>.test.js
```

## Rules
- Flow: route → validate(schema) → controller → service → model.
- Errors: `next(new ErrorHandler("CODE"))` or `next(new ErrorHandler("CODE", { errors }))`; the status
  comes from the catalog. One global error middleware. Never send raw errors or stack traces to the client.
- Joi schemas set message KEYS, not text: `.messages({ "any.required": "emailRequired" })` (keys in
  `FIELD_MESSAGES`, or a code). `validate()` reports every bad field; `req.lang` is `en` | `ar`.
- Response shape: success `{ success: true, data }`, error `{ success: false, code, message, errors? }`.
  `message` is localized by `Accept-Language` (en/ar); codes and texts live in `src/constants/messages.js`.
  Validation failures are 400 with an `errors` field map. Details: `docs/standards.md` §2.
- Every protected route: `requireAuth` (sets `req.auth`) + `requirePermission(moduleKey, action)` (ADMIN bypasses),
  or `requireAccessLevel(...levels)` for access-level-only routes (e.g. owner-only).
  Users must never read or change another user's/department's data unless their role allows it.
- List endpoints: `?page=1&limit=20&search=` → `{ items, total, page, limit }`.
- DB changes only through migrations. Never `sync({ force: true })`.
- Passwords hashed with bcrypt. Never return password fields.
- Use transactions for multi-table writes.

## MySQL specifics
- dialect "mysql", charset utf8mb4 / collate utf8mb4_unicode_ci, timezone "+00:00" (store UTC).
- IDs: DataTypes.UUID (stored as CHAR(36)) with defaultValue DataTypes.UUIDV4.
- Add indexes in migrations for foreign keys and columns used in filters/search (email, employee_code, status, dates).
- Search with Op.like (`%term%`); no Postgres-only features (ILIKE, JSONB, arrays, RETURNING).
- Money as DECIMAL(12,2) for single amounts and DECIMAL(14,2) for aggregate totals (payroll run/payslip
  gross and net, staffing bill total), never FLOAT. Currency CHAR(3), default 'SAR'. Dates without time as DATEONLY.
- Tenant column is always `employer_id`. Soft delete only via `deleted_at` (paranoid models).
- The `users` model hides `password` by default; use `User.scope("withPassword")` only for login checks.

## Tests
- One test file per module in `tests/`. Use a separate test DB (`hrms_test`).
- Every endpoint: success case, validation errors, auth (401), role (403), not found (404), edge cases.
- Assert status code AND response body/message.

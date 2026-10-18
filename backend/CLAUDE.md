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
│   ├── middlewares/        # requireAuth, requireRole, validate, errorHandler
│   └── utils/ErrorHandler.js
├── migrations/  seeders/
└── tests/                  # <module>.test.js
```

## Rules
- Flow: route → validate(schema) → controller → service → model.
- Errors: `next(new ErrorHandler(status, "message"))`. One global error middleware.
  Never send raw errors or stack traces to the client.
- Response shape: success `{ success: true, data }`, error `{ success: false, message }`.
- Every protected route: `requireAuth` + `requireRole(...roles)`.
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
- Money (salary/payroll) as DECIMAL(12,2), never FLOAT. Dates without time as DATEONLY.

## Tests
- One test file per module in `tests/`. Use a separate test DB (`hrms_test`).
- Every endpoint: success case, validation errors, auth (401), role (403), not found (404), edge cases.
- Assert status code AND response body/message.

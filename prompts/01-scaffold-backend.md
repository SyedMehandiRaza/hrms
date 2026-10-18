# Prompt 01 — Scaffold the backend (run ONCE)

## Step A — paste this in Claude Code (switch to Plan mode first: Shift+Tab)

```
Scaffold backend/ exactly per backend/CLAUDE.md:
- npm init, install: express, sequelize, mysql2, sequelize-cli, joi,
  jsonwebtoken, bcrypt, cors, helmet, dotenv, morgan
  dev: jest, supertest, nodemon, eslint, cross-env
- src/app.js (cors with CLIENT_URL, helmet, json, morgan, routes, global error handler)
- src/server.js (listen on PORT)
- Sequelize config for MySQL (dialect "mysql") reading .env (dev = DB_NAME,
  test = DB_NAME_TEST), charset utf8mb4, timezone "+00:00", .sequelizerc
- src/utils/ErrorHandler.js + src/middlewares/errorHandler.js
- src/middlewares/requireAuth.js (JWT access token), requireRole.js, validate.js (Joi)
- GET /api/health → { success: true, data: { status: "ok" } } with a test
- User model + migration (id uuid, name, email unique, password hash, role enum
  SUPER_ADMIN/HR/MANAGER/EMPLOYEE, status ACTIVE/INACTIVE, timestamps)
- Seeder creating the 4 users from docs/test-users.md
- npm scripts: dev, start, test (cross-env NODE_ENV=test jest --runInBand), lint
- Do NOT create .env — I will create it from .env.example.

Also in hrms/: create src/api/client.js (axios instance, baseURL from
import.meta.env.VITE_API_URL, attaches token from localStorage).
Install axios in hrms if missing.

Show me the plan and file list first.
```

## Step B — after you approve the plan

```
/goal Scaffold done when: in backend/ `npm test` passes and `npm run lint`
has 0 errors; GET /api/health returns { success: true }; migrations and
seeders run without errors; hrms/src/api/client.js exists. Commit with
message "chore: scaffold backend".
```

## Step C — YOU do this (Claude can't read .env)
1. Copy `backend/.env.example` → `backend/.env`, fill DB_PASSWORD and both JWT secrets.
2. Copy `hrms/.env.example` → `hrms/.env`.
3. In MySQL (MySQL Workbench or `mysql -u root -p`) create two databases:
   ```sql
   CREATE DATABASE hrms_dev  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE DATABASE hrms_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Run:
   ```
   cd backend
   npx sequelize-cli db:migrate
   npx sequelize-cli db:seed:all
   npm run dev
   ```
5. Open http://localhost:5000/api/health → should show `{"success":true,...}`.

# Test users (DEV / TEST database only — never real accounts)

Created by the backend seeder (`npx sequelize-cli db:seed:all`).
The ui-tester agent logs in with these.

| Role        | Email                  | Password      |
|-------------|------------------------|---------------|
| SUPER_ADMIN | admin@hrms.test        | Test@12345    |
| HR          | hr@hrms.test           | Test@12345    |
| MANAGER     | manager@hrms.test      | Test@12345    |
| EMPLOYEE    | employee@hrms.test     | Test@12345    |

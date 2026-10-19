# 12: Departments API

**What to build:** Create, list, view, edit and delete departments, unique per company, with delete blocked while
employees are linked (D31, D33, D36, D37).

**Blocked by:** 02 Schema changes, 04 Login, refresh, logout (Auth)

**Status:** done

- [x] The list paginates, searches name and code, filters by status, and returns stats (total, active, inactive);
      each row has the head's name and its designation count. Viewing one adds total employees.
- [x] Creating a valid department → 201; the code is stored uppercase; created-by and updated-by are the caller.
- [x] "hr" when "HR" exists → 409 `DEPARTMENT_NAME_TAKEN` "A department with this name already exists."; a used
      code → 409 `DEPARTMENT_CODE_TAKEN` "A department with this code already exists."; the same name in another
      company is allowed.
- [x] Field errors under each field: "Department Name is required",
      "Department Name must be at least 2 characters", "Department Name cannot exceed 150 characters",
      "Department Name cannot contain emojis", "Dept. Code is required", "Dept. Code cannot exceed 50 characters",
      "Dept. Code cannot contain emojis", "Description cannot exceed 2000 characters",
      "Description cannot contain emojis".
- [x] A head who isn't an active employee of this company → "Select an active employee of this company." under
      the head field.
- [x] Deleting a department with any linked employee, even an exited one → 409 `DEPARTMENT_IN_USE`
      "This department has employees and can't be deleted."; an unused department is deleted together with its
      designations, and its name can be used again.
- [x] Another company's department → 404 "The requested record was not found." on view, edit and delete.
- [x] A role without the matching department flag → 403 "You don't have permission to do this."; the owner is
      always allowed; the staffing company is refused.

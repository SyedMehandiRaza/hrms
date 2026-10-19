# 26: Departments list screen

**What to build:** `/admin/departments` shows real departments with stats, search, status filter and pagination;
the existing modal creates and edits; delete works with confirmation. The row click and Edit button, which
currently do nothing, open the modal (D31).

**Blocked by:** 14 UI foundation, 12 Departments API

**Status:** done

Verified by the ui-tester agent:

- [x] Loading state, then the list and stats; search and status filter change the results; pagination works.
- [x] Empty company → the empty state.
- [x] Create "Quality Assurance" / code "qa" → toast "Department Created Successfully" → appears with code "QA";
      stats update.
- [x] Field errors under the inputs: "Department Name is required", "Department Name must be at least 2 characters",
      "Department Name cannot exceed 150 characters", "Department Name cannot contain emojis",
      "Dept. Code is required", "Dept. Code cannot exceed 50 characters", "Dept. Code cannot contain emojis",
      "Description cannot exceed 2000 characters", "Description cannot contain emojis".
- [x] Duplicate name in another case → "A department with this name already exists."; duplicate code →
      "A department with this code already exists."
- [x] Clicking a row or Edit opens the modal with current values; saving → "Department Updated Successfully".
- [x] Delete a department with employees → "This department has employees and can't be deleted."; an unused one →
      removed from the list.
- [x] The Head dropdown shows "No employees found" when the company has no active employees.
- [x] A sub-admin without create/update/delete permission doesn't see those buttons.
- [x] Load failure → error state with the server message and Retry.
- [x] Lint passes.

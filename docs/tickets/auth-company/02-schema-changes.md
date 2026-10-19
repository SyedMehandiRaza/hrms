# 02: Schema changes for Auth and Company setup

**What to build:** The database supports lockout, session "last used" times, reusable names after soft
delete, and no longer holds the duplicate staffing-login columns (plan §1 "Schema changes needed", D10, D14,
D22, D31, D32). New migrations only; existing migrations are never edited.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A person has a failed-login counter (default 0) and a "locked until" time (empty by default).
- [ ] A session has a "last used" time.
- [ ] Staffing companies no longer have "login enabled" or "must change password"; the staffing seed data and
      model no longer mention them; rolling the migration back restores both columns with their old defaults.
- [ ] Department code is required. Existing departments without a code get one derived from their name
      (uppercased) before the column becomes required.
- [ ] Departments: two live departments in one company can't share a name or a code, ignoring case; the same
      name in two companies is fine; a soft-deleted department's name and code can be used again.
- [ ] Designations: two live designations in one department can't share a name (ignoring case); two live
      designations in one company can't share a code; soft-deleted names and codes can be reused.
- [ ] Every new migration migrates up and rolls back cleanly on a fresh test database, and all seeders still run.

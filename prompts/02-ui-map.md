# Prompt 02 — Map your static UI (run ONCE)

Turns your finished React screens into a module list Claude can plan from.

```
Read every route, page and component in hrms/src. Do not change any file
except docs/ui-map.md.

Write docs/ui-map.md with:
1. Route table: path → page file → which roles use it.
2. Per screen:
   - data shown (tables + columns, cards, counts)
   - forms + every field (type, looks required?, any visible hints)
   - buttons/actions (create, edit, delete, approve, export, filters, search)
   - static/mock data location (file + variable) to be replaced later
3. Modules: group screens into modules (e.g. Auth, Dashboard, Employees,
   Departments, Attendance, Leave, Payroll, Reports, Settings — use what
   actually exists). List them in build order by dependency (Auth first).
4. QUESTIONS: anything the UI doesn't make clear (business rules, who can
   approve, limits, calculations). Never invent answers.

Then print the module list and the questions.
```

After it finishes, open `docs/ui-map.md` and read it. Fix anything wrong.

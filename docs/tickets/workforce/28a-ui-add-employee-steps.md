# 28a: Add employee wizard — Basic, Job, Salary + save draft

**What to build:** `/admin/employees/add-employee` steps 1–3 load real options and validate like the server, and
any step can be saved as a draft (D44–D52, D53).

**Blocked by:** 12 Employee drafts API, 12b Roles and staffing-company lookups API, 13b At-create setup; geo 05 UI
shared Country, City and Phone inputs

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Employee (create, edit)".

Verified by the ui-tester agent:

- [ ] Basic: moving on with a used ID number, email or phone shows "An employee with this ID number already exists." /
      "An employee with this email already exists." (or "This email is already used by another company.") /
      "An employee with this phone number already exists."
- [ ] Basic: Nationality, the phone code and the new Residence country → city (approved UI addition) use the shared
      inputs; the phone code starts as +966 and doesn't change when the nationality changes.
- [ ] Job: projects list only active projects; main project required and among them; general employee limited to one
      project; leave policies list active types, one per type; shifts, departments → designations, roles and staffing
      companies (Contract only) come from the API.
- [ ] Job: Admin access level isn't accepted ("This company already has an owner. Add other admins as Sub Admin."),
      Sub admin is offered only to the owner, and role is required only for Sub admin (a company with no roles can
      still add an Employee).
- [ ] Joining date before the main project's start → "Joining date can't be before the main project's start date.";
      more than 12 months ahead → "Joining date can't be more than 12 months ahead."
- [ ] Salary: currency defaults to SAR; Basic, Housing and Transport are the first locked rows and aren't offered again;
      the mode options follow the employment type; Hourly shows only the rate and min hours.
- [ ] Salary field errors (Basic 0, percentage over 100, duplicate component, hours over 24, overtime rate) show the
      §7.2 texts under the rows.
- [ ] Documents step stays visible and isn't sent.
- [ ] Save as draft on any step → toast, URL gets `?draft=`; reload resumes the same values and step.
- [ ] Lint passes.

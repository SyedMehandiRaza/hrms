# 06: Recipient lookup API

**What to build:** A read-only picker source for the send wizard. It never writes employee or staffing data and
never calls the Employees module (plan decision 20, ADR 0008).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] When HR looks up employees → id, name, employee code, main project, staffing company and status, paginated.
- [ ] When HR filters by project or staffing company, or searches by name or code → only matching employees.
- [ ] When HR filters by a project → every employee with an active assignment on it is listed, whether or not it is
      their main project; employees whose assignment there has ended aren't.
- [ ] When an employee has no active main project → they are listed with a blank project.
- [ ] When HR looks up staffing companies → id, name, code and status; searching matches name or code.
- [ ] When an employee is exited, deleted or has no current account, or a staffing company is inactive, deleted,
      has no login, or its login's account in this company has ended → it is listed and marked inactive, not hidden.
- [ ] When the account is suspended → the recipient is listed as active.
- [ ] When HR looks up recipients → only their own company's records are returned.
- [ ] When a sub-admin without `contract:create`, the employee or the staffing company calls it → 403 / "You don't
      have permission to do this."
- [ ] When the lookup runs → no employee, account or staffing-company row is changed.

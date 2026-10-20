const crypto = require("crypto");

const db = require("../src/models");
const { build } = require("./helpers/factory");
const { startEmployeeSequences } = require("../src/migrations/20261020600002-workforce-number-sequences");

// Workforce schema (ticket workforce#01; docs/plans/workforce-and-lifecycle.md §3, ADRs 0010, 0011).

const { UniqueConstraintError, ValidationError, DatabaseError, ForeignKeyConstraintError } = db.Sequelize;
const short = () => crypto.randomUUID().slice(0, 8);

afterAll(async () => {
  await db.sequelize.close();
});

const company = () => build(db, "Employer");
const office = (employer, extra = {}) => db.Office.create({ employer_id: employer.id, office_name: `Office ${short()}`, ...extra });
const project = (employer, officeRow, extra = {}) =>
  db.Project.create({
    employer_id: employer.id,
    office_id: officeRow.id,
    project_name: `Project ${short()}`,
    project_code: `PRJ-${short()}`,
    ...extra,
  });
const rawInsert = (sql, replacements) => db.sequelize.query(sql, { replacements });
const columns = async (table) => Object.keys(await db.sequelize.getQueryInterface().describeTable(table));

describe("head offices and projects (ADR 0010)", () => {
  it("a project needs a head office, at the database too", async () => {
    const employer = await company();
    await expect(
      rawInsert(
        "INSERT INTO projects (id, employer_id, project_name, project_code, created_at, updated_at) VALUES (UUID(), ?, 'No Office', ?, NOW(), NOW())",
        [employer.id, `X-${short()}`]
      )
    ).rejects.toThrow(DatabaseError);
  });

  it("a second project for the same head office fails at the database", async () => {
    const employer = await company();
    const hq = await office(employer);
    await project(employer, hq);
    await expect(project(employer, hq)).rejects.toThrow(UniqueConstraintError);
  });

  it("a head office whose project is soft-deleted still can't take another one (one row per office)", async () => {
    const employer = await company();
    const hq = await office(employer);
    const first = await project(employer, hq);
    await first.destroy();
    await expect(project(employer, hq)).rejects.toThrow(UniqueConstraintError);
  });

  it("head offices have no stored status", async () => {
    expect(await columns("offices")).not.toContain("status");
    expect(db.Office.rawAttributes.status).toBeUndefined();
  });

  it("project status accepts ACTIVE, ON_HOLD, COMPLETED only", async () => {
    const employer = await company();
    for (const status of ["ACTIVE", "ON_HOLD", "COMPLETED"]) {
      const row = await project(employer, await office(employer), { status });
      expect(row.status).toBe(status);
    }
    // Sequelize doesn't check ENUM values; MySQL refuses the unknown one.
    await expect(project(employer, await office(employer), { status: "INACTIVE" })).rejects.toThrow(DatabaseError);
    const hq = await office(employer);
    await expect(
      rawInsert(
        "INSERT INTO projects (id, employer_id, office_id, project_name, project_code, status, created_at, updated_at) VALUES (UUID(), ?, ?, 'Raw', ?, 'INACTIVE', NOW(), NOW())",
        [employer.id, hq.id, `R-${short()}`]
      )
    ).rejects.toThrow(DatabaseError);
  });

  it.each([
    ["office", (employer, name) => office(employer, { office_name: name })],
    ["project", async (employer, name) => project(employer, await office(employer), { project_name: name })],
  ])("%s names are unique per company (any case) among live rows, and reusable after a soft delete", async (_kind, create) => {
    const employer = await company();
    const other = await company();
    const first = await create(employer, "Riyadh HQ");
    await expect(create(employer, "riyadh hq")).rejects.toThrow(UniqueConstraintError);
    await create(other, "Riyadh HQ");
    await first.destroy();
    const reused = await create(employer, "Riyadh HQ");
    expect(reused.id).toBeTruthy();
  });
});

describe("approval groups (ADR 0011)", () => {
  it("names are unique per company, inactive groups included", async () => {
    const employer = await company();
    const make = (name, extra = {}) =>
      db.ApprovalGroup.create({ employer_id: employer.id, group_name: name, group_code: `C-${short()}`, module_key: "ALL", ...extra });
    await make("HR Exit", { is_active: false });
    await expect(make("hr exit")).rejects.toThrow(UniqueConstraintError);
    const other = await company();
    await db.ApprovalGroup.create({ employer_id: other.id, group_name: "HR Exit", group_code: "HR-EXIT", module_key: "ALL" });
  });
});

describe("number sequences (D10, D45)", () => {
  const sequence = (employer, docType, fyId) =>
    db.NumberSequence.create({ employer_id: employer.id, doc_type: docType, financial_year_id: fyId });

  it("accept PROJECT per financial year and EMPLOYEE with no year", async () => {
    const employer = await company();
    const fy1 = await build(db, "FinancialYear", { employer_id: employer.id, year_key: 2026 });
    const fy2 = await build(db, "FinancialYear", { employer_id: employer.id, year_key: 2027 });
    await sequence(employer, "PROJECT", fy1.id);
    await sequence(employer, "PROJECT", fy2.id);
    await expect(sequence(employer, "PROJECT", fy1.id)).rejects.toThrow(UniqueConstraintError);
    const emp = await sequence(employer, "EMPLOYEE", null);
    expect(emp.financial_year_id).toBeNull();
  });

  it("a second EMPLOYEE sequence for the same company fails at the database", async () => {
    const employer = await company();
    await sequence(employer, "EMPLOYEE", null);
    await expect(sequence(employer, "EMPLOYEE", null)).rejects.toThrow(UniqueConstraintError);
    const other = await company();
    await sequence(other, "EMPLOYEE", null);
  });

  it("an existing company's EMPLOYEE sequence starts at its highest EMP- number", async () => {
    const employer = await company();
    for (const code of ["EMP-0003", "EMP-0011", "LEGACY-9"]) {
      await build(db, "Employee", { employer_id: employer.id, employee_code: code });
    }
    await startEmployeeSequences(db.sequelize);
    const row = await db.NumberSequence.findOne({ where: { employer_id: employer.id, doc_type: "EMPLOYEE" } });
    expect(row.last_no).toBe(11);
    expect(row.financial_year_id).toBeNull();

    // Already started: running again changes nothing.
    await row.update({ last_no: 12 });
    await startEmployeeSequences(db.sequelize);
    expect(await db.NumberSequence.count({ where: { employer_id: employer.id, doc_type: "EMPLOYEE" } })).toBe(1);
    expect((await row.reload()).last_no).toBe(12);
  });
});

describe("employee history (D55) and salary components (D42)", () => {
  it("project history rows carry an effective date", async () => {
    expect(await columns("hrms_employee_project_history")).toContain("effective_date");
    const row = await build(db, "EmployeeProjectHistory", { effective_date: "2026-11-01" });
    expect(row.effective_date).toBe("2026-11-01");
  });

  it("main-project periods record employee, project, from and to", async () => {
    const employee = await build(db, "Employee");
    const hq = await office(await db.Employer.findByPk(employee.employer_id));
    const prj = await project({ id: employee.employer_id }, hq);
    const period = await db.EmployeeMainProjectPeriod.create({
      employer_id: employee.employer_id,
      employee_id: employee.id,
      project_id: prj.id,
      date_from: "2026-01-01",
    });
    expect(period.date_to).toBeUndefined();
    await expect(db.EmployeeMainProjectPeriod.create({ employer_id: employee.employer_id, employee_id: employee.id, project_id: prj.id })).rejects.toThrow(
      ValidationError
    );
  });

  it("shift history rows carry employer_id (required)", async () => {
    expect(await columns("hrms_employee_shift_history")).toContain("employer_id");
    const employee = await build(db, "Employee");
    const shift = await build(db, "CompanyShift", { employer_id: employee.employer_id });
    await expect(
      rawInsert(
        "INSERT INTO hrms_employee_shift_history (id, employee_id, shift_id, effective_from, created_at, updated_at) VALUES (UUID(), ?, ?, '2026-01-01', NOW(), NOW())",
        [employee.id, shift.id]
      )
    ).rejects.toThrow(DatabaseError);
  });

  it("salary components carry is_default (false unless set)", async () => {
    const plain = await build(db, "SalaryComponent");
    expect(plain.is_default).toBe(false);
    const basic = await build(db, "SalaryComponent", { is_default: true, is_system: true });
    expect(basic.is_default).toBe(true);
  });
});

describe("approval requests: the owner as an actor (D27)", () => {
  const groupFor = (employer) =>
    db.ApprovalGroup.create({ employer_id: employer.id, group_name: `G ${short()}`, group_code: `G-${short()}`, module_key: "ALL" });

  it("a request records its raiser as a user; the employee is optional", async () => {
    const employer = await company();
    const owner = await db.User.findByPk(employer.user_id);
    const request = await db.ApprovalRequest.create({
      employer_id: employer.id,
      approval_group_id: (await groupFor(employer)).id,
      module_key: "EXIT",
      entity_type: "EMPLOYEE_EXIT",
      entity_id: crypto.randomUUID(),
      request_code: `EX-${short()}`,
      requested_by: null,
      requested_by_user_id: owner.id,
      requested_at: new Date(),
    });
    expect(request.requested_by).toBeNull();
    await expect(
      db.ApprovalRequest.create({
        employer_id: employer.id,
        approval_group_id: (await groupFor(employer)).id,
        module_key: "EXIT",
        entity_type: "EMPLOYEE_EXIT",
        entity_id: crypto.randomUUID(),
        request_code: `EX-${short()}`,
        requested_at: new Date(),
      })
    ).rejects.toThrow(ValidationError);
  });

  it("an override log row has an actor and no member or employee", async () => {
    const request = await build(db, "ApprovalRequest");
    const owner = await build(db, "User");
    const log = await db.ApprovalRequestLog.create({
      approval_request_id: request.id,
      approval_group_member_id: null,
      employee_id: null,
      actor_user_id: owner.id,
      is_override: true,
      level_no: 1,
      status: "APPROVED",
    });
    expect(log.is_override).toBe(true);
    const plain = await build(db, "ApprovalRequestLog");
    expect(plain.is_override).toBe(false);
  });

  it("an unknown actor fails the foreign key", async () => {
    const request = await build(db, "ApprovalRequest");
    await expect(
      db.ApprovalRequestLog.create({ approval_request_id: request.id, actor_user_id: crypto.randomUUID(), level_no: 1 })
    ).rejects.toThrow(ForeignKeyConstraintError);
  });
});

describe("exits (D58–D60)", () => {
  it("default to PENDING_APPROVAL, accept REJECTED, link a request and keep a reject reason", async () => {
    const exit = await build(db, "EmployeeExit");
    expect(exit.status).toBe("PENDING_APPROVAL");
    const request = await build(db, "ApprovalRequest");
    await exit.update({ status: "REJECTED", approval_request_id: request.id, reject_reason: "Not now" });
    await exit.reload();
    expect([exit.status, exit.approval_request_id, exit.reject_reason]).toEqual(["REJECTED", request.id, "Not now"]);
  });

  it.each(["APPROVED", "REJECTED", "WITHDRAWN"])("exit events accept %s", async (eventType) => {
    const event = await build(db, "ExitEvent", { event_type: eventType });
    expect(event.event_type).toBe(eventType);
  });
});

describe("permission modules", () => {
  it("the exit module exists", async () => {
    const mod = await db.Module.findOne({ where: { module_key: "exit" } });
    expect(mod).not.toBeNull();
    expect(mod.name).toBe("Exits");
  });
});

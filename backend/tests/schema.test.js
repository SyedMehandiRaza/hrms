const db = require("../src/models");
const { build } = require("./helpers/factory");
const { deriveDepartmentCode } = require("../src/utils/departmentCode");

// Schema changes for Auth + Company setup (ticket auth-company#02).
// The global setup rebuilds the test DB with undo:all + migrate, so these
// columns and keys only exist if the new migrations run up (and down) cleanly.

const qi = () => db.sequelize.getQueryInterface();
const columnsOf = (table) => qi().describeTable(table);

afterAll(async () => {
  await db.sequelize.close();
});

describe("users: lockout columns", () => {
  it("defaults failed_login_attempts to 0 and locked_until to null", async () => {
    const user = await build(db, "User");
    const fresh = await db.User.findByPk(user.id);
    expect(fresh.failed_login_attempts).toBe(0);
    expect(fresh.locked_until).toBeNull();
  });

  it("has a NOT NULL integer counter and a nullable lock time in the table", async () => {
    const cols = await columnsOf("users");
    expect(cols.failed_login_attempts).toMatchObject({ allowNull: false, defaultValue: "0" });
    expect(cols.failed_login_attempts.type).toMatch(/^INT/);
    expect(cols.locked_until).toMatchObject({ allowNull: true });
    expect(cols.locked_until.type).toMatch(/^DATETIME/);
  });

  it("stores a lock time", async () => {
    const until = new Date(Date.UTC(2026, 9, 19, 10, 15, 0));
    const user = await build(db, "User", { failed_login_attempts: 5, locked_until: until });
    const fresh = await db.User.findByPk(user.id);
    expect(fresh.failed_login_attempts).toBe(5);
    expect(fresh.locked_until.toISOString()).toBe(until.toISOString());
  });
});

describe("hrms_sessions: last_used_at", () => {
  it("has a nullable last_used_at column", async () => {
    const cols = await columnsOf("hrms_sessions");
    expect(cols.last_used_at).toMatchObject({ allowNull: true });
    expect(cols.last_used_at.type).toMatch(/^DATETIME/);
  });

  it("stores the last used time", async () => {
    const usedAt = new Date(Date.UTC(2026, 9, 19, 8, 0, 0));
    const session = await build(db, "HrmsSession", { last_used_at: usedAt });
    const fresh = await db.HrmsSession.findByPk(session.id);
    expect(fresh.last_used_at.toISOString()).toBe(usedAt.toISOString());
  });
});

describe("hrms_staffing_companies: duplicate login columns removed", () => {
  it("no longer has login_enabled or must_change_password in the table", async () => {
    const cols = await columnsOf("hrms_staffing_companies");
    expect(cols).not.toHaveProperty("login_enabled");
    expect(cols).not.toHaveProperty("must_change_password");
  });

  it("no longer declares them on the model", () => {
    expect(db.StaffingCompany.rawAttributes).not.toHaveProperty("login_enabled");
    expect(db.StaffingCompany.rawAttributes).not.toHaveProperty("must_change_password");
  });
});

describe("hrms_departments", () => {
  it("requires a code in the table", async () => {
    const cols = await columnsOf("hrms_departments");
    expect(cols.code).toMatchObject({ allowNull: false });
  });

  it("rejects a department without a code (model)", async () => {
    const employer = await build(db, "Employer");
    await expect(db.Department.create({ employer_id: employer.id, name: "No Code" })).rejects.toThrow(
      /notNull|cannot be null/i
    );
  });

  it("rejects a department without a code (database)", async () => {
    const employer = await build(db, "Employer");
    await expect(
      db.sequelize.query(
        "INSERT INTO hrms_departments (id, employer_id, name, code, status) VALUES (UUID(), ?, 'Raw', NULL, 'ACTIVE')",
        { replacements: [employer.id] }
      )
    ).rejects.toThrow(/cannot be null/i);
  });

  it("blocks two live departments with the same name in one company, ignoring case", async () => {
    const employer = await build(db, "Employer");
    await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    await expect(build(db, "Department", { employer_id: employer.id, name: "FINANCE", code: "FIN2" })).rejects.toThrow(
      db.Sequelize.UniqueConstraintError
    );
  });

  it("blocks two live departments with the same code in one company, ignoring case", async () => {
    const employer = await build(db, "Employer");
    await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    await expect(build(db, "Department", { employer_id: employer.id, name: "Fiscal", code: "fin" })).rejects.toThrow(
      db.Sequelize.UniqueConstraintError
    );
  });

  it("allows the same name and code in two companies", async () => {
    const a = await build(db, "Employer");
    const b = await build(db, "Employer");
    await build(db, "Department", { employer_id: a.id, name: "Finance", code: "FIN" });
    const other = await build(db, "Department", { employer_id: b.id, name: "Finance", code: "FIN" });
    expect(other.id).toBeDefined();
  });

  it("lets a soft-deleted department's name and code be used again", async () => {
    const employer = await build(db, "Employer");
    const old = await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    await old.destroy();
    const reused = await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    expect(reused.id).not.toBe(old.id);
  });

  it("allows several soft-deleted departments with the same name and code", async () => {
    const employer = await build(db, "Employer");
    for (let i = 0; i < 2; i += 1) {
      const row = await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
      await row.destroy();
    }
    const live = await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    expect(live.id).toBeDefined();
  });

  it("still blocks a live duplicate of a reused name after a soft delete", async () => {
    const employer = await build(db, "Employer");
    const old = await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    await old.destroy();
    await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    await expect(build(db, "Department", { employer_id: employer.id, name: "finance", code: "FIN3" })).rejects.toThrow(
      db.Sequelize.UniqueConstraintError
    );
  });

  it("blocks restoring a soft-deleted department whose name is taken again", async () => {
    const employer = await build(db, "Employer");
    const old = await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN" });
    await old.destroy();
    await build(db, "Department", { employer_id: employer.id, name: "Finance", code: "FIN-NEW" });
    await expect(old.restore()).rejects.toThrow(db.Sequelize.UniqueConstraintError);
  });
});

describe("hrms_designations", () => {
  const setup = async () => {
    const employer = await build(db, "Employer");
    const deptA = await build(db, "Department", { employer_id: employer.id });
    const deptB = await build(db, "Department", { employer_id: employer.id });
    return { employer, deptA, deptB };
  };
  const designation = (employer, dept, fields) =>
    build(db, "Designation", { employer_id: employer.id, department_id: dept.id, ...fields });

  it("blocks two live designations with the same name in one department, ignoring case", async () => {
    const { employer, deptA } = await setup();
    await designation(employer, deptA, { name: "Accountant" });
    await expect(designation(employer, deptA, { name: "ACCOUNTANT" })).rejects.toThrow(db.Sequelize.UniqueConstraintError);
  });

  it("allows the same name in two departments of one company", async () => {
    const { employer, deptA, deptB } = await setup();
    await designation(employer, deptA, { name: "Accountant" });
    const other = await designation(employer, deptB, { name: "Accountant" });
    expect(other.id).toBeDefined();
  });

  it("blocks two live designations with the same code in one company, ignoring case", async () => {
    const { employer, deptA, deptB } = await setup();
    await designation(employer, deptA, { name: "Accountant", code: "ACC" });
    await expect(designation(employer, deptB, { name: "Auditor", code: "acc" })).rejects.toThrow(
      db.Sequelize.UniqueConstraintError
    );
  });

  it("allows the same code in two companies", async () => {
    const one = await setup();
    const two = await setup();
    await designation(one.employer, one.deptA, { name: "Accountant", code: "ACC" });
    const other = await designation(two.employer, two.deptA, { name: "Accountant", code: "ACC" });
    expect(other.id).toBeDefined();
  });

  it("allows many designations without a code", async () => {
    const { employer, deptA } = await setup();
    await designation(employer, deptA, { name: "Clerk", code: null });
    const second = await designation(employer, deptA, { name: "Driver", code: null });
    expect(second.id).toBeDefined();
  });

  it("lets a soft-deleted designation's name and code be used again", async () => {
    const { employer, deptA } = await setup();
    const old = await designation(employer, deptA, { name: "Accountant", code: "ACC" });
    await old.destroy();
    const reused = await designation(employer, deptA, { name: "Accountant", code: "ACC" });
    expect(reused.id).not.toBe(old.id);
  });

  it("allows several soft-deleted designations with the same name and code", async () => {
    const { employer, deptA } = await setup();
    for (let i = 0; i < 2; i += 1) {
      const row = await designation(employer, deptA, { name: "Accountant", code: "ACC" });
      await row.destroy();
    }
    const live = await designation(employer, deptA, { name: "Accountant", code: "ACC" });
    expect(live.id).toBeDefined();
  });
});

describe("deriveDepartmentCode (backfill for departments without a code)", () => {
  it("uppercases the name", () => {
    expect(deriveDepartmentCode("Finance", [])).toBe("FINANCE");
  });

  it("truncates to 50 characters", () => {
    const code = deriveDepartmentCode("a".repeat(80), []);
    expect(code).toBe("A".repeat(50));
  });

  it("appends a numeric suffix when the code is taken in the company, ignoring case", () => {
    expect(deriveDepartmentCode("Finance", ["finance"])).toBe("FINANCE-2");
    expect(deriveDepartmentCode("Finance", ["FINANCE", "FINANCE-2"])).toBe("FINANCE-3");
  });

  it("keeps a suffixed code within 50 characters", () => {
    const name = "b".repeat(60);
    const code = deriveDepartmentCode(name, ["B".repeat(50)]);
    expect(code).toBe(`${"B".repeat(48)}-2`);
    expect(code.length).toBe(50);
  });

  it("trims surrounding spaces before deriving", () => {
    expect(deriveDepartmentCode("  Human Resources  ", [])).toBe("HUMAN RESOURCES");
  });
});

describe("password_reset_otps: reset token columns (ticket auth-company#07)", () => {
  it("has a nullable unique reset_token_hash and a nullable reset_token_expires_at", async () => {
    const cols = await columnsOf("password_reset_otps");
    expect(cols.reset_token_hash).toMatchObject({ allowNull: true });
    expect(cols.reset_token_hash.type).toMatch(/^CHAR\(64\)/);
    expect(cols.reset_token_expires_at).toMatchObject({ allowNull: true });
    expect(cols.reset_token_expires_at.type).toMatch(/^DATETIME/);

    const indexes = await qi().showIndex("password_reset_otps");
    const unique = indexes.find((ix) => ix.fields.some((f) => f.attribute === "reset_token_hash"));
    expect(unique).toMatchObject({ unique: true });
  });

  it("stores a reset token hash and expiry", async () => {
    const expires = new Date(Date.UTC(2026, 9, 19, 8, 15, 0));
    const hash = "a".repeat(64);
    const row = await build(db, "PasswordResetOtp", { reset_token_hash: hash, reset_token_expires_at: expires });
    const fresh = await db.PasswordResetOtp.findByPk(row.id);
    expect(fresh.reset_token_hash).toBe(hash);
    expect(fresh.reset_token_expires_at.toISOString()).toBe(expires.toISOString());
  });
});

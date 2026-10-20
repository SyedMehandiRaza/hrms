const db = require("../src/models");
const { build } = require("./helpers/factory");

// Schema changes for Contract Studio (ticket contract-studio#01, plan decision 46).
// The global setup rebuilds the test DB with undo:all + migrate, so these columns,
// enum values and keys only exist if the new migrations run up (and down) cleanly.

const ACTIVE = ["SENT", "VIEWED", "SUBMITTED"];
const INACTIVE = ["DRAFT", "COMPLETED", "REJECTED", "EXPIRED", "REVOKED"];

afterAll(async () => {
  await db.sequelize.close();
});

// One company with a type and an employee recipient.
const setup = async () => {
  const employer = await build(db, "Employer");
  const type = await build(db, "ContractType", { employer_id: employer.id });
  const employee = await build(db, "Employee", { employer_id: employer.id });
  return { employer, type, employee };
};

const contract = ({ employer, type, employee }, fields = {}) =>
  build(db, "Contract", {
    employer_id: employer.id,
    contract_type_id: type.id,
    recipient_key: `E:${employee.id}`,
    ...fields,
  });

describe("hrms_contracts", () => {
  it("stores a revoked contract with reason, time and revoker", async () => {
    const ctx = await setup();
    const revoker = await build(db, "User");
    const revokedAt = new Date(Date.UTC(2026, 9, 20, 9, 30, 0));
    const reason = "r".repeat(500);
    const row = await contract(ctx, { status: "REVOKED", revoke_reason: reason, revoked_at: revokedAt, revoked_by: revoker.id });
    const fresh = await db.Contract.findByPk(row.id);
    expect(fresh.status).toBe("REVOKED");
    expect(fresh.revoke_reason).toBe(reason);
    expect(fresh.revoked_at.toISOString()).toBe(revokedAt.toISOString());
    expect(fresh.revoked_by).toBe(revoker.id);
  });

  it("refuses a revoke reason over 500 characters", async () => {
    const ctx = await setup();
    await expect(contract(ctx, { status: "REVOKED", revoke_reason: "r".repeat(501) })).rejects.toThrow(/too long/i);
  });

  it("stores rate, rate unit, currency and notice period", async () => {
    const ctx = await setup();
    const row = await contract(ctx, { rate: "4500.50", rate_unit: "MONTHLY", currency: "USD", notice_period_days: 30 });
    const fresh = await db.Contract.findByPk(row.id);
    expect(fresh.rate).toBe("4500.50");
    expect(fresh.rate_unit).toBe("MONTHLY");
    expect(fresh.currency).toBe("USD");
    expect(fresh.notice_period_days).toBe(30);
  });

  it("defaults the currency to SAR", async () => {
    const ctx = await setup();
    const row = await contract(ctx);
    const fresh = await db.Contract.findByPk(row.id);
    expect(fresh.currency).toBe("SAR");
  });

  it("stores the hashes, signed PDF path and reminder time", async () => {
    const ctx = await setup();
    const remindedAt = new Date(Date.UTC(2026, 9, 21, 6, 0, 0));
    const row = await contract(ctx, {
      values_sha256: "a".repeat(64),
      signed_pdf_path: "emp/signed/x.pdf",
      signed_pdf_sha256: "b".repeat(64),
      reminder_sent_at: remindedAt,
    });
    const fresh = await db.Contract.findByPk(row.id);
    expect(fresh.values_sha256).toBe("a".repeat(64));
    expect(fresh.signed_pdf_path).toBe("emp/signed/x.pdf");
    expect(fresh.signed_pdf_sha256).toBe("b".repeat(64));
    expect(fresh.reminder_sent_at.toISOString()).toBe(remindedAt.toISOString());
  });

  it.each(ACTIVE)("refuses a second active contract when the first is %s", async (status) => {
    const ctx = await setup();
    await contract(ctx, { status });
    for (const second of ACTIVE) {
      await expect(contract(ctx, { status: second })).rejects.toThrow(db.Sequelize.UniqueConstraintError);
    }
  });

  it("refuses a draft that becomes a second active contract", async () => {
    const ctx = await setup();
    await contract(ctx, { status: "SENT" });
    const draft = await contract(ctx, { status: "DRAFT" });
    await expect(draft.update({ status: "SENT" })).rejects.toThrow(db.Sequelize.UniqueConstraintError);
  });

  it.each(INACTIVE)("accepts a new active contract when the other is %s", async (status) => {
    const ctx = await setup();
    await contract(ctx, { status });
    const active = await contract(ctx, { status: "SENT" });
    expect(active.id).toBeDefined();
  });

  it("accepts a new active contract when the other active one is deleted", async () => {
    const ctx = await setup();
    const old = await contract(ctx, { status: "SENT" });
    await old.destroy();
    const active = await contract(ctx, { status: "SENT" });
    expect(active.id).toBeDefined();
  });

  it("accepts active contracts of another type or for another recipient", async () => {
    const ctx = await setup();
    await contract(ctx, { status: "SENT" });
    const otherType = await build(db, "ContractType", { employer_id: ctx.employer.id });
    const otherEmployee = await build(db, "Employee", { employer_id: ctx.employer.id });
    expect((await contract({ ...ctx, type: otherType }, { status: "SENT" })).id).toBeDefined();
    expect((await contract({ ...ctx, employee: otherEmployee }, { status: "SENT" })).id).toBeDefined();
  });

  it("never writes the generated active key from the model", () => {
    expect(db.Contract.rawAttributes).not.toHaveProperty("active_key");
  });

  it("refuses to remove a contract type used by a contract (database)", async () => {
    const ctx = await setup();
    await contract(ctx);
    await expect(
      db.sequelize.query("DELETE FROM hrms_contract_types WHERE id = ?", { replacements: [ctx.type.id] })
    ).rejects.toThrow(/foreign key constraint fails/i);
  });

  it("has an index on (status, expires_at) for the expiry job", async () => {
    const indexes = await db.sequelize.getQueryInterface().showIndex("hrms_contracts");
    const ix = indexes.find((i) => i.fields.map((f) => f.attribute).join(",") === "status,expires_at");
    expect(ix).toBeDefined();
  });
});

describe("hrms_contract_documents", () => {
  it("stores a 64-character file hash", async () => {
    const hash = "c".repeat(64);
    const doc = await build(db, "ContractDocument", { file_sha256: hash });
    const fresh = await db.ContractDocument.findByPk(doc.id);
    expect(fresh.file_sha256).toBe(hash);
  });
});

describe("hrms_contract_templates", () => {
  it("stores the contract type", async () => {
    const employer = await build(db, "Employer");
    const type = await build(db, "ContractType", { employer_id: employer.id });
    const template = await build(db, "ContractTemplate", { employer_id: employer.id, contract_type_id: type.id });
    const fresh = await db.ContractTemplate.findByPk(template.id, { include: ["contractType"] });
    expect(fresh.contract_type_id).toBe(type.id);
    expect(fresh.contractType.id).toBe(type.id);
  });

  it("allows a template without a type in the database", async () => {
    const template = await build(db, "ContractTemplate");
    expect(template.contract_type_id).toBeUndefined();
  });

  it("refuses to remove a contract type used by a template (database)", async () => {
    const employer = await build(db, "Employer");
    const type = await build(db, "ContractType", { employer_id: employer.id });
    await build(db, "ContractTemplate", { employer_id: employer.id, contract_type_id: type.id });
    await expect(
      db.sequelize.query("DELETE FROM hrms_contract_types WHERE id = ?", { replacements: [type.id] })
    ).rejects.toThrow(/foreign key constraint fails/i);
  });
});

describe("template and contract fields", () => {
  it.each(["ContractTemplateField", "ContractField"])("%s stores DATE, INITIALS and merge source CONTRACT", async (model) => {
    for (const field_type of ["DATE", "INITIALS"]) {
      const row = await build(db, model, { field_type });
      expect((await db[model].findByPk(row.id)).field_type).toBe(field_type);
    }
    const merge = await build(db, model, { field_type: "DB_COLUMN", db_source: "CONTRACT", db_column: "contract_no" });
    expect((await db[model].findByPk(merge.id)).db_source).toBe("CONTRACT");
  });
});

describe("hrms_contract_recipients", () => {
  it("stores a 500-character reject reason, signed IP, user agent and evidence", async () => {
    const reason = "x".repeat(500);
    const evidence = { consent_version: "v1", ip: "203.0.113.7", values_sha256: "d".repeat(64) };
    const row = await build(db, "ContractRecipient", {
      reject_reason: reason,
      signed_ip: "2001:db8::1",
      signed_user_agent: "Mozilla/5.0 (Test)",
      evidence,
    });
    const fresh = await db.ContractRecipient.findByPk(row.id);
    expect(fresh.reject_reason).toBe(reason);
    expect(fresh.signed_ip).toBe("2001:db8::1");
    expect(fresh.signed_user_agent).toBe("Mozilla/5.0 (Test)");
    expect(fresh.evidence).toEqual(evidence);
  });
});

describe("hrms_contract_activities", () => {
  it("stores the REVOKED action", async () => {
    const row = await build(db, "ContractActivity", { action: "REVOKED" });
    expect((await db.ContractActivity.findByPk(row.id)).action).toBe("REVOKED");
  });
});

describe("hrms_contract_types", () => {
  it("refuses two types with the same name in one company, ignoring case", async () => {
    const employer = await build(db, "Employer");
    await build(db, "ContractType", { employer_id: employer.id, name: "Extension", code: "EXT" });
    await expect(build(db, "ContractType", { employer_id: employer.id, name: "EXTENSION", code: "EXT2" })).rejects.toThrow(
      db.Sequelize.UniqueConstraintError
    );
  });

  it("stores the same name in two companies", async () => {
    const a = await build(db, "Employer");
    const b = await build(db, "Employer");
    await build(db, "ContractType", { employer_id: a.id, name: "Extension", code: "EXT" });
    const other = await build(db, "ContractType", { employer_id: b.id, name: "Extension", code: "EXT" });
    expect(other.id).toBeDefined();
  });
});

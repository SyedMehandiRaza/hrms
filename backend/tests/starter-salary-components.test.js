const crypto = require("crypto");
const request = require("supertest");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { addToEveryCompany } = require("../src/migrations/20261020600006-starter-salary-components");

// Starter salary components (ticket workforce#02; docs/plans/workforce-and-lifecycle.md D42).

const STARTER = [
  ["BASIC", "Basic Salary", "EARNING", true, true],
  ["HOUSING", "Housing Allowance", "EARNING", true, true],
  ["TRANSPORT", "Transport Allowance", "EARNING", true, true],
  ["HOURLY", "Hourly", "EARNING", false, true],
  ["FOOD", "Food Allowance", "EARNING", false, false],
  ["OTHER_ALLOWANCE", "Other Allowance", "EARNING", false, false],
  ["GOSI", "GOSI Contribution", "DEDUCTION", false, false],
  ["ADVANCE", "Salary Advance Recovery", "DEDUCTION", false, false],
  ["ABSENCE", "Absence Deduction", "DEDUCTION", false, false],
];

const uniqueEmail = () => `starter-${crypto.randomUUID().slice(0, 8)}@hrms.test`;
const signup = (email) =>
  request(app)
    .post("/api/auth/signup")
    .send({ companyName: "Starter Co", name: "Starter Owner", email, password: "Test@12345", confirmPassword: "Test@12345" });
const componentsOf = async (employerId) =>
  (
    await db.SalaryComponent.findAll({
      where: { employer_id: employerId },
      attributes: ["code", "name", "type", "is_default", "is_system", "is_active"],
      order: [["code", "ASC"]],
      raw: true,
    })
  ).map((c) => [c.code, c.name, c.type, Boolean(c.is_default), Boolean(c.is_system), Boolean(c.is_active)]);
const employerOf = async (email) => db.Employer.findOne({ where: { user_id: (await db.User.findOne({ where: { email } })).id } });

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

describe("sign up", () => {
  it("gives the new company the 9 starter components with their codes, types and kinds", async () => {
    const email = uniqueEmail();
    expect((await signup(email)).status).toBe(201);
    const employer = await employerOf(email);
    const expected = STARTER.map((row) => [...row, true]).sort((a, b) => a[0].localeCompare(b[0]));
    expect(await componentsOf(employer.id)).toEqual(expected);
  });

  it("BASIC, HOUSING and TRANSPORT are default + system; HOURLY is system only; the other five are neither", async () => {
    const email = uniqueEmail();
    await signup(email);
    const rows = await componentsOf((await employerOf(email)).id);
    const byCode = Object.fromEntries(rows.map((r) => [r[0], { isDefault: r[3], isSystem: r[4] }]));
    ["BASIC", "HOUSING", "TRANSPORT"].forEach((c) => expect(byCode[c]).toEqual({ isDefault: true, isSystem: true }));
    expect(byCode.HOURLY).toEqual({ isDefault: false, isSystem: true });
    ["FOOD", "OTHER_ALLOWANCE", "GOSI", "ADVANCE", "ABSENCE"].forEach((c) => expect(byCode[c]).toEqual({ isDefault: false, isSystem: false }));
  });

  it("a second company's components are its own", async () => {
    const [a, b] = [uniqueEmail(), uniqueEmail()];
    await signup(a);
    await signup(b);
    const [ea, eb] = [await employerOf(a), await employerOf(b)];
    expect(await db.SalaryComponent.count({ where: { employer_id: ea.id } })).toBe(9);
    expect(await db.SalaryComponent.count({ where: { employer_id: eb.id } })).toBe(9);
    const idsA = (await db.SalaryComponent.findAll({ where: { employer_id: ea.id } })).map((c) => c.id);
    const idsB = (await db.SalaryComponent.findAll({ where: { employer_id: eb.id } })).map((c) => c.id);
    expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
  });

  it("is one transaction: a failure later in sign-up leaves no company and no components", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const before = await db.SalaryComponent.count();
    const employersBefore = await db.Employer.count({ paranoid: false });
    jest.spyOn(db.FinancialYear, "create").mockRejectedValueOnce(new Error("boom"));
    const res = await signup(uniqueEmail());
    expect(res.status).toBe(500);
    expect(await db.SalaryComponent.count()).toBe(before);
    expect(await db.Employer.count({ paranoid: false })).toBe(employersBefore);
  });
});

describe("data migration for existing companies", () => {
  const legacyCompany = async () => {
    const owner = await db.User.create({ name: "Legacy Owner", email: uniqueEmail() });
    return db.Employer.create({ user_id: owner.id, company_name: "Legacy Co", employer_status: "ACTIVE" });
  };

  it("adds what's missing, skipping codes or names the company already has, and marks the defaults", async () => {
    const employer = await legacyCompany();
    await db.SalaryComponent.create({ employer_id: employer.id, code: "BASIC", name: "Basic Salary", type: "EARNING" });
    await db.SalaryComponent.create({ employer_id: employer.id, code: "MEALS", name: "food allowance", type: "EARNING" });

    await db.sequelize.transaction((transaction) => addToEveryCompany(db.sequelize, transaction));

    const rows = await componentsOf(employer.id);
    const codes = rows.map((r) => r[0]);
    expect(codes).toEqual(["ABSENCE", "ADVANCE", "BASIC", "GOSI", "HOURLY", "HOUSING", "MEALS", "OTHER_ALLOWANCE", "TRANSPORT"]);
    const basic = rows.find((r) => r[0] === "BASIC");
    expect([basic[3], basic[4]]).toEqual([true, true]);
  });

  it("re-running it adds nothing", async () => {
    const employer = await legacyCompany();
    await db.sequelize.transaction((transaction) => addToEveryCompany(db.sequelize, transaction));
    const first = await db.SalaryComponent.count({ where: { employer_id: employer.id } });
    const { added } = await db.sequelize.transaction((transaction) => addToEveryCompany(db.sequelize, transaction));
    expect(first).toBe(9);
    expect(await db.SalaryComponent.count({ where: { employer_id: employer.id } })).toBe(9);
    expect(added).toBe(0);
  });
});

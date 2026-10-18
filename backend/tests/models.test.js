const db = require("../src/models");
const { build } = require("./helpers/factory");

// Every table from docs/backend-plan.md section 4, in migration order.
// Grows group by group; each name must have a model, a table and working associations.
const EXPECTED_MODELS = [
  // Group 0: lookups and identity
  "Country",
  "City",
  "IndustryType",
  "Module",
  "User",
  "PasswordResetOtp",
  // Group 1: tenant
  "Employer",
  "CompanyTimeSetting",
  "FinancialYear",
  "NumberSequence",
  "PeriodLock",
  "Role",
  "RolePermission",
  "HrmsAccount",
  "HrmsSession",
  "Notification",
];

afterAll(async () => {
  await db.sequelize.close();
});

describe("model registry", () => {
  it("registers exactly the expected models", () => {
    expect(Object.keys(db.sequelize.models).sort()).toEqual([...EXPECTED_MODELS].sort());
  });
});

describe.each(EXPECTED_MODELS)("%s", (modelName) => {
  it("creates a row with required parents", async () => {
    const row = await build(db, modelName);
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("loads every association", async () => {
    const row = await build(db, modelName);
    const model = db[modelName];
    for (const alias of Object.keys(model.associations)) {
      const found = await model.findByPk(row.id, { include: [{ association: alias }], paranoid: false });
      expect(found).not.toBeNull();
    }
  });
});

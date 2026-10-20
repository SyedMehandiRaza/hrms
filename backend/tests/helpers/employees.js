const { db, short, uniqueEmail, ownerCompany, createProject, api } = require("./api");
const { seedId } = require("../../src/utils/seed");
const { addStarterSalaryComponents } = require("../../src/utils/starterSalaryComponents");

// Fixtures for creating employees through POST /api/employees (workforce 13a, 13b).

const IN = seedId("country:IN");

// A leave type with its one policy (MONTHLY_ACCRUAL unless overridden).
const createLeavePolicy = async (employer, { type = {}, ...policy } = {}) => {
  const leaveType = await db.LeaveType.create({ employer_id: employer.id, leave_name: `Leave ${short()}`, leave_code: `L${short()}`.toUpperCase(), ...type });
  return db.LeavePolicy.create({
    employer_id: employer.id,
    leave_type_id: leaveType.id,
    policy_name: leaveType.leave_name,
    yearly_quota: 21,
    monthly_accrual: 1.75,
    accrual_method: "MONTHLY_ACCRUAL",
    ...policy,
  });
};

// A company (owner logged in) with one ACTIVE project, the starter salary components (by code)
// and one leave policy.
const employeeSetup = async () => {
  const ctx = await ownerCompany();
  const project = await createProject(ctx.employer, { start_date: "2026-01-01" });
  await addStarterSalaryComponents(db.sequelize, ctx.employer.id);
  const rows = await db.SalaryComponent.findAll({ where: { employer_id: ctx.employer.id } });
  const components = Object.fromEntries(rows.map((c) => [c.code, c]));
  const policy = await createLeavePolicy(ctx.employer);
  return { ...ctx, project, components, policy };
};

const monthlyRows = (ctx, { basic = 5000, housing = 1250, transport = 500 } = {}) => [
  { componentId: ctx.components.BASIC.id, amount: basic },
  { componentId: ctx.components.HOUSING.id, amount: housing },
  { componentId: ctx.components.TRANSPORT.id, amount: transport },
];

const employeeBody = (ctx, overrides = {}) => ({
  name: "Ahmed Ali",
  country_emp_id: `ID${short()}`.slice(0, 10).toUpperCase(),
  email: uniqueEmail("new"),
  phone: "0501234567",
  phoneCountry: "SA",
  nationalityCountryId: IN,
  employmentType: "FULL_TIME",
  accessLevel: "EMPLOYEE",
  projectIds: [ctx.project.id],
  mainProjectId: ctx.project.id,
  leavePolicyIds: [ctx.policy.id],
  currency: "SAR",
  salaryMode: "MONTHLY_FIXED",
  components: monthlyRows(ctx),
  ...overrides,
});

const createEmployeeVia = (ctx, overrides, token = ctx.token) => api.post("/api/employees", token, employeeBody(ctx, overrides));
const createdEmployee = async (ctx, overrides, token) => {
  const res = await createEmployeeVia(ctx, overrides, token);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data;
};

module.exports = { IN, createLeavePolicy, employeeSetup, employeeBody, monthlyRows, createEmployeeVia, createdEmployee };

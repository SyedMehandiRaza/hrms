const { db, MISSING_ID, errorBody, validationBody, createFinancialYear, createProject } = require("./helpers/api");
const { employeeSetup, createLeavePolicy, monthlyRows, createEmployeeVia, createdEmployee } = require("./helpers/employees");
const { clock } = require("../src/utils/clock");
const mailer = require("../src/services/mailer");

// At-create setup: leave, shift, salary (ticket workforce#13b; workforce D33, D34, D40, D52).

const TODAY = "2026-10-21";

beforeEach(() => {
  jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`));
  mailer.clear();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const create = createEmployeeVia;
const created = createdEmployee;
const num = (v) => (v === null ? null : Number(v));

const balancesOf = (employeeId) => db.LeaveBalance.findAll({ where: { employee_id: employeeId }, raw: true });
const ledgerOf = (employeeId) => db.LeaveBalanceTransaction.findAll({ where: { employee_id: employeeId }, raw: true });

describe("leave policies (D33)", () => {
  it("assigns each policy from the joining date", async () => {
    const ctx = await employeeSetup();
    const second = await createLeavePolicy(ctx.employer);
    const data = await created(ctx, { leavePolicyIds: [ctx.policy.id, second.id], joiningDate: "2026-09-01" });
    const rows = await db.EmployeeLeavePolicy.findAll({ where: { employee_id: data.id }, raw: true });
    expect(rows.map((r) => [r.leave_policy_id, r.effective_from, Boolean(r.is_active)]).sort()).toEqual(
      [
        [ctx.policy.id, "2026-09-01", true],
        [second.id, "2026-09-01", true],
      ].sort()
    );
  });

  it.each([
    ["missing", undefined],
    ["empty", []],
  ])("no policy (%s) → leavePolicyIds 'Select at least one leave policy'", async (_label, leavePolicyIds) => {
    const ctx = await employeeSetup();
    expect((await create(ctx, { leavePolicyIds })).body).toEqual(validationBody({ leavePolicyIds: "leavePolicyRequired" }));
  });

  it("two policies of the same type (or the same one twice) → 'Choose one policy per leave type.'", async () => {
    const ctx = await employeeSetup();
    const sameType = await db.LeavePolicy.create({ employer_id: ctx.employer.id, leave_type_id: ctx.policy.leave_type_id, policy_name: "Another", yearly_quota: 10 });
    expect((await create(ctx, { leavePolicyIds: [ctx.policy.id, sameType.id] })).body).toEqual(validationBody({ leavePolicyIds: "leavePolicyPerType" }));
    expect((await create(ctx, { leavePolicyIds: [ctx.policy.id, ctx.policy.id] })).body).toEqual(validationBody({ leavePolicyIds: "leavePolicyPerType" }));
  });

  it("an inactive policy, or a policy of an inactive leave type → 'Select active leave policies only.'", async () => {
    const ctx = await employeeSetup();
    const inactive = await createLeavePolicy(ctx.employer, { is_active: false });
    const typeOff = await createLeavePolicy(ctx.employer, { type: { is_active: false } });
    for (const p of [inactive, typeOff]) {
      expect((await create(ctx, { leavePolicyIds: [ctx.policy.id, p.id] })).body).toEqual(validationBody({ leavePolicyIds: "leavePoliciesActive" }));
    }
  });

  it("another company's or an unknown policy → 404 NOT_FOUND", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    for (const id of [other.policy.id, MISSING_ID]) {
      expect((await create(ctx, { leavePolicyIds: [ctx.policy.id, id] })).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("leave balances (D34)", () => {
  it("UPFRONT 21 days, prorated, joining 1 July in a Jan–Dec FY → 10.5 with one CREDIT ledger row (SYSTEM)", async () => {
    const ctx = await employeeSetup();
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", yearly_quota: 21, prorate_joiners: true });
    const data = await created(ctx, { leavePolicyIds: [upfront.id], joiningDate: "2026-07-01" });
    const fy = await db.FinancialYear.findOne({ where: { employer_id: ctx.employer.id, year_key: 2026 } });
    const [balance] = await balancesOf(data.id);
    expect(balance).toMatchObject({ leave_type_id: upfront.leave_type_id, leave_policy_id: upfront.id, financial_year_id: fy.id, balance_year: 2026, status: "OPEN" });
    expect([num(balance.accrued_balance), num(balance.total_allocated), num(balance.available_balance), num(balance.consumed_balance)]).toEqual([10.5, 10.5, 10.5, 0]);
    const ledger = await ledgerOf(data.id);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ leave_balance_id: balance.id, transaction_type: "CREDIT", leave_source: "SYSTEM", transaction_date: "2026-07-01", leave_year: 2026 });
    expect([num(ledger[0].days), num(ledger[0].balance_before), num(ledger[0].balance_after)]).toEqual([10.5, 0, 10.5]);
  });

  it("UPFRONT without proration → the full quota", async () => {
    const ctx = await employeeSetup();
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", yearly_quota: 21, prorate_joiners: false });
    const data = await created(ctx, { leavePolicyIds: [upfront.id], joiningDate: "2026-07-01" });
    expect(num((await balancesOf(data.id))[0].available_balance)).toBe(21);
  });

  it("MONTHLY_ACCRUAL → balance 0 and no ledger row", async () => {
    const ctx = await employeeSetup();
    const data = await created(ctx, { joiningDate: "2026-07-01" });
    const balances = await balancesOf(data.id);
    expect(balances).toHaveLength(1);
    expect([num(balances[0].accrued_balance), num(balances[0].available_balance)]).toEqual([0, 0]);
    expect(await ledgerOf(data.id)).toEqual([]);
  });

  it("joining in a previous FY → only the current FY's balance, prorated from that FY's start (full quota)", async () => {
    const ctx = await employeeSetup();
    const project = await createProject(ctx.employer, { start_date: "2025-01-01" });
    await createFinancialYear(ctx.employer, 2025, { status: "CLOSED" });
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", yearly_quota: 21, prorate_joiners: true });
    const data = await created(ctx, { projectIds: [project.id], mainProjectId: project.id, leavePolicyIds: [upfront.id], joiningDate: "2025-06-01" });
    const balances = await balancesOf(data.id);
    expect(balances.map((b) => [b.balance_year, num(b.available_balance)])).toEqual([[2026, 21]]);
    expect((await ledgerOf(data.id)).map((l) => l.transaction_date)).toEqual(["2026-01-01"]);
  });

  it("joining in the next FY, which exists → that FY's balance, prorated from the joining date", async () => {
    const ctx = await employeeSetup();
    await createFinancialYear(ctx.employer, 2027, { status: "PLANNED" });
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", yearly_quota: 21, prorate_joiners: true });
    const data = await created(ctx, { leavePolicyIds: [upfront.id], joiningDate: "2027-07-01" });
    const balances = await balancesOf(data.id);
    // 1 Jul – 31 Dec 2027 = 184 of 365 days → 21 × 184 / 365 = 10.58 → 10.5
    expect(balances.map((b) => [b.balance_year, num(b.available_balance)])).toEqual([[2027, 10.5]]);
  });

  it("joining in the next FY, not created yet → no balance row and no error", async () => {
    const ctx = await employeeSetup();
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", yearly_quota: 21 });
    const data = await created(ctx, { leavePolicyIds: [upfront.id], joiningDate: "2027-02-01" });
    expect(await balancesOf(data.id)).toEqual([]);
    expect(await ledgerOf(data.id)).toEqual([]);
    expect(await db.EmployeeLeavePolicy.count({ where: { employee_id: data.id } })).toBe(1);
  });
});

describe("shift (D40)", () => {
  it("optional; when given it's stored with a history row from the joining date", async () => {
    const ctx = await employeeSetup();
    const shift = await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Day", start_time: "08:00:00", end_time: "17:00:00" });
    const data = await created(ctx, { shiftId: shift.id, joiningDate: "2026-10-01" });
    expect((await db.Employee.findByPk(data.id)).shift_id).toBe(shift.id);
    expect(await db.EmployeeShiftHistory.findAll({ where: { employee_id: data.id }, raw: true })).toEqual([
      expect.objectContaining({ shift_id: shift.id, effective_from: "2026-10-01" }),
    ]);
    const none = await created(ctx, { phone: "0501234568" });
    expect((await db.Employee.findByPk(none.id)).shift_id).toBeNull();
    expect(await db.EmployeeShiftHistory.count({ where: { employee_id: none.id } })).toBe(0);
  });

  it("another company's, an unknown or a deleted shift → 404 NOT_FOUND", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const theirs = await db.CompanyShift.create({ employer_id: other.employer.id, name: "Night", start_time: "20:00:00", end_time: "05:00:00" });
    const deleted = await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Old", start_time: "08:00:00", end_time: "12:00:00" });
    await deleted.destroy();
    for (const shiftId of [theirs.id, deleted.id, MISSING_ID]) {
      expect((await create(ctx, { shiftId })).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("salary (D52)", () => {
  it("saves a MONTHLY_FIXED salary from the joining date as the only active salary, with OT 1.5 by default", async () => {
    const ctx = await employeeSetup();
    const rows = [...monthlyRows(ctx), { componentId: ctx.components.FOOD.id, calculationType: "PERCENTAGE", amount: 10 }];
    const data = await created(ctx, { components: rows, joiningDate: "2026-10-01" });
    const salaries = await db.EmployeeSalary.findAll({ where: { employee_id: data.id }, raw: true });
    expect(salaries).toEqual([
      expect.objectContaining({ employer_id: ctx.employer.id, currency: "SAR", salary_calc_mode: "MONTHLY_FIXED", effective_from: "2026-10-01", effective_to: null, is_active: 1 }),
    ]);
    const parts = await db.EmployeeSalaryComponent.findAll({ where: { employee_salary_id: salaries[0].id }, raw: true });
    const byId = Object.fromEntries(parts.map((p) => [p.salary_component_id, p]));
    expect([byId[ctx.components.BASIC.id].calculation_type, num(byId[ctx.components.BASIC.id].amount), byId[ctx.components.BASIC.id].percent_base]).toEqual(["FIXED", 5000, null]);
    expect(num(byId[ctx.components.HOUSING.id].amount)).toBe(1250);
    expect(num(byId[ctx.components.TRANSPORT.id].amount)).toBe(500);
    const food = byId[ctx.components.FOOD.id];
    expect([food.calculation_type, num(food.amount)]).toEqual(["PERCENTAGE", 10]);
    expect(typeof food.percent_base === "string" ? JSON.parse(food.percent_base) : food.percent_base).toEqual(["BASIC"]);
    expect(num((await db.Employee.findByPk(data.id)).overtime_rate)).toBe(1.5);
  });

  it("MONTHLY_HOURLY saves the working hours; currency defaults to SAR; OT rate as given", async () => {
    const ctx = await employeeSetup();
    const data = await created(ctx, { salaryMode: "MONTHLY_HOURLY", workingHours: 8, currency: undefined, overtimeRate: 2.5 });
    const salary = await db.EmployeeSalary.findOne({ where: { employee_id: data.id } });
    expect([salary.salary_calc_mode, num(salary.working_hours), salary.currency]).toEqual(["MONTHLY_HOURLY", 8, "SAR"]);
    expect(num((await db.Employee.findByPk(data.id)).overtime_rate)).toBe(2.5);
  });

  it("HOURLY (contract) saves the hourly rate as the Hourly component and the min hours; a staffing worker's OT defaults to 1", async () => {
    const ctx = await employeeSetup();
    const staffing = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf Manpower", code: "GM-HR" });
    const data = await created(ctx, { employmentType: "CONTRACT", staffingCompanyId: staffing.id, salaryMode: "HOURLY", hourlyRate: 25, minHours: 160, components: [] });
    const salary = await db.EmployeeSalary.findOne({ where: { employee_id: data.id } });
    expect([salary.salary_calc_mode, num(salary.min_hours), salary.working_hours]).toEqual(["HOURLY", 160, null]);
    const parts = await db.EmployeeSalaryComponent.findAll({ where: { employee_salary_id: salary.id }, raw: true });
    expect(parts.map((p) => [p.salary_component_id, p.calculation_type, num(p.amount)])).toEqual([[ctx.components.HOURLY.id, "FIXED", 25]]);
    expect(num((await db.Employee.findByPk(data.id)).overtime_rate)).toBe(1);
  });

  it("a currency other than SAR → currency 'Currency must be SAR.'", async () => {
    const ctx = await employeeSetup();
    expect((await create(ctx, { currency: "USD" })).body).toEqual(validationBody({ currency: "currencySar" }));
  });

  it.each([
    ["Full-time + HOURLY", { employmentType: "FULL_TIME", salaryMode: "HOURLY", hourlyRate: 20, components: [] }],
    ["Contract + MONTHLY_FIXED", { employmentType: "CONTRACT", salaryMode: "MONTHLY_FIXED" }],
    ["missing mode", { salaryMode: undefined }],
    ["unknown mode", { salaryMode: "WEEKLY" }],
  ])("%s → salaryMode 'This salary mode isn't available for this employment type.'", async (_label, overrides) => {
    const ctx = await employeeSetup();
    expect((await create(ctx, overrides)).body).toEqual(validationBody({ salaryMode: "salaryModeInvalid" }));
  });

  it("a staffing-company contract + MONTHLY_HOURLY → salaryMode error", async () => {
    const ctx = await employeeSetup();
    const staffing = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf Manpower", code: "GM-MH" });
    const res = await create(ctx, { employmentType: "CONTRACT", staffingCompanyId: staffing.id, salaryMode: "MONTHLY_HOURLY", workingHours: 8 });
    expect(res.body).toEqual(validationBody({ salaryMode: "salaryModeInvalid" }));
  });

  it("a plain contract may use MONTHLY_HOURLY or HOURLY", async () => {
    const ctx = await employeeSetup();
    expect((await create(ctx, { employmentType: "CONTRACT", salaryMode: "MONTHLY_HOURLY", workingHours: 8 })).status).toBe(201);
    expect((await create(ctx, { employmentType: "CONTRACT", salaryMode: "HOURLY", hourlyRate: 20, components: [], phone: "0501234568" })).status).toBe(201);
  });

  describe("monthly component rows", () => {
    const rowsWith = (ctx, change) => change(monthlyRows(ctx));

    it.each([
      ["no rows", () => [], "componentRequired"],
      ["no BASIC", (rows) => rows.slice(1), "defaultComponentsRequired"],
      ["no HOUSING", (rows) => [rows[0], rows[2]], "defaultComponentsRequired"],
      ["no TRANSPORT", (rows) => rows.slice(0, 2), "defaultComponentsRequired"],
      ["Basic 0", (rows) => [{ ...rows[0], amount: 0 }, rows[1], rows[2]], "basicPositive"],
      ["a duplicate", (rows) => [...rows, rows[1]], "duplicateComponent"],
      ["a negative amount", (rows) => [rows[0], { ...rows[1], amount: -1 }, rows[2]], "amountEveryRow"],
      ["a missing amount", (rows) => [rows[0], { componentId: rows[1].componentId }, rows[2]], "amountEveryRow"],
      ["a non-number amount", (rows) => [rows[0], { ...rows[1], amount: "lots" }, rows[2]], "amountEveryRow"],
    ])("%s → components error", async (_label, change, key) => {
      const ctx = await employeeSetup();
      expect((await create(ctx, { components: rowsWith(ctx, change) })).body).toEqual(validationBody({ components: key }));
    });

    it("an inactive component → 'Select active components only.'", async () => {
      const ctx = await employeeSetup();
      await ctx.components.FOOD.update({ is_active: false });
      const res = await create(ctx, { components: [...monthlyRows(ctx), { componentId: ctx.components.FOOD.id, amount: 100 }] });
      expect(res.body).toEqual(validationBody({ components: "componentsActive" }));
    });

    it("a PERCENTAGE row over 100 → 'A percentage component cannot exceed 100'; exactly 100 is fine", async () => {
      const ctx = await employeeSetup();
      const pct = (amount) => [...monthlyRows(ctx), { componentId: ctx.components.FOOD.id, calculationType: "PERCENTAGE", amount }];
      expect((await create(ctx, { components: pct(100.5) })).body).toEqual(validationBody({ components: "percentMax" }));
      expect((await create(ctx, { components: pct(100) })).status).toBe(201);
    });

    it("another company's component → 404 NOT_FOUND", async () => {
      const ctx = await employeeSetup();
      const other = await employeeSetup();
      const res = await create(ctx, { components: [...monthlyRows(ctx), { componentId: other.components.FOOD.id, amount: 1 }] });
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    });
  });

  it.each([
    [{ salaryMode: "MONTHLY_HOURLY" }, { workingHours: "workingHours" }],
    [{ salaryMode: "MONTHLY_HOURLY", workingHours: 0 }, { workingHours: "workingHours" }],
    [{ salaryMode: "MONTHLY_HOURLY", workingHours: 24.5 }, { workingHours: "workingHours" }],
    [{ employmentType: "CONTRACT", salaryMode: "HOURLY", components: [] }, { hourlyRate: "hourlyRate" }],
    [{ employmentType: "CONTRACT", salaryMode: "HOURLY", hourlyRate: 0, components: [] }, { hourlyRate: "hourlyRate" }],
    [{ employmentType: "CONTRACT", salaryMode: "HOURLY", hourlyRate: 20, minHours: -1, components: [] }, { minHours: "minHours" }],
    [{ overtimeRate: 0.5 }, { overtimeRate: "overtimeRate" }],
    [{ overtimeRate: 5.5 }, { overtimeRate: "overtimeRate" }],
    [{ overtimeRate: 1.25 }, { overtimeRate: "overtimeRate" }],
  ])("%j → field error %j", async (overrides, fields) => {
    const ctx = await employeeSetup();
    expect((await create(ctx, overrides)).body).toEqual(validationBody(fields));
  });

  it("MONTHLY_HOURLY with exactly 24 hours, OT 1 and OT 5 are fine", async () => {
    const ctx = await employeeSetup();
    expect((await create(ctx, { salaryMode: "MONTHLY_HOURLY", workingHours: 24, overtimeRate: 1 })).status).toBe(201);
    expect((await create(ctx, { overtimeRate: 5, phone: "0501234568" })).status).toBe(201);
  });
});

describe("one transaction", () => {
  it("a failure while saving the salary rolls back the whole employee (leave, shift and all)", async () => {
    const ctx = await employeeSetup();
    const shift = await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Day", start_time: "08:00:00", end_time: "17:00:00" });
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", yearly_quota: 21 });
    jest.spyOn(db.EmployeeSalaryComponent, "create").mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await create(ctx, { shiftId: shift.id, leavePolicyIds: [upfront.id] });
    expect(res.status).toBe(500);
    const where = { employer_id: ctx.employer.id };
    expect(await db.Employee.count({ where })).toBe(0);
    expect(await db.EmployeeLeavePolicy.count({ where })).toBe(0);
    expect(await db.LeaveBalance.count({ where })).toBe(0);
    expect(await db.LeaveBalanceTransaction.count({ where })).toBe(0);
    expect(await db.EmployeeShiftHistory.count({ where })).toBe(0);
    expect(await db.EmployeeSalary.count({ where })).toBe(0);
    expect(mailer.outbox()).toEqual([]);
  });
});

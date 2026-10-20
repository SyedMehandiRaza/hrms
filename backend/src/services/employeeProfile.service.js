const { Op } = require("sequelize");
const {
  sequelize,
  Employee,
  Employer,
  User,
  HrmsAccount,
  Role,
  Country,
  City,
  Department,
  Designation,
  StaffingCompany,
  CompanyShift,
  Project,
  EmployeeProject,
  EmployeeProjectHistory,
  EmployeeLeavePolicy,
  LeavePolicy,
  LeaveType,
  EmployeeSalary,
  EmployeeSalaryComponent,
  SalaryComponent,
  EmployeeApprovalRouting,
  ApprovalGroup,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { ACCESS_LEVELS, PANELS } = require("../constants/accessLevels");
const { UUID, likePattern } = require("./department.service");
const { localName } = require("./geo.service");
const { revokeSessions } = require("./auth.service");
const { issueLoginCredentials } = require("./credentials.service");

// Employee list, detail, bulk (de)activate and resend login (docs/plans/workforce-and-lifecycle.md
// D47, D56, D56a, D57). Always the caller's own company. EXITED employees are read-only.

const num = (value) => (value === null || value === undefined ? null : Number(value));
const ref = (row, nameKey = "name") => (row ? { id: row.id, name: row[nameKey] } : null);

// ---------- GET /employees ----------

// One row per employee with their login in this company, role, main project and staffing company.
const LIST_SQL = (where) => `
  FROM employees e
  JOIN users u ON u.id = e.user_id
  LEFT JOIN hrms_accounts a ON a.user_id = e.user_id AND a.employer_id = e.employer_id AND a.deleted_at IS NULL
  LEFT JOIN roles r ON r.id = a.role_id
  LEFT JOIN employee_projects mp ON mp.employee_id = e.id AND mp.is_active = 1 AND mp.main_project = 1
  LEFT JOIN projects p ON p.id = mp.project_id
  LEFT JOIN hrms_staffing_companies s ON s.id = e.staffing_company_id
  WHERE e.employer_id = :employerId AND e.deleted_at IS NULL ${where}`;

const toListItem = (row) => ({
  id: row.id,
  employee_code: row.employee_code,
  country_emp_id: row.country_emp_id,
  name: row.full_name,
  email: row.email,
  employment_status: row.employment_status,
  account_status: row.account_status || null,
  access_level: row.access_level || null,
  role: row.role_id ? { id: row.role_id, name: row.role_name } : null,
  employment_type: row.employment_type,
  main_project: row.project_id ? { id: row.project_id, name: row.project_name, code: row.project_code } : null,
  staffing_company: row.staffing_id ? { id: row.staffing_id, name: row.staffing_name } : null,
});

// ?projectId= (main or secondary, current) &employmentType= &roleId= &status= &search= (name,
// Employee ID, ID number, email) &page= &limit=. By Employee ID.
const listEmployees = async ({ employerId }, { page, limit, search, status, employmentType, projectId, roleId }) => {
  const replacements = { employerId, limit, offset: (page - 1) * limit };
  let where = "";
  if (status) {
    where += " AND e.employment_status = :status";
    replacements.status = status;
  }
  if (employmentType) {
    where += " AND e.employment_type = :employmentType";
    replacements.employmentType = employmentType;
  }
  if (roleId) {
    where += " AND a.role_id = :roleId";
    replacements.roleId = roleId;
  }
  if (projectId) {
    where += " AND EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id = e.id AND ep.project_id = :projectId AND ep.is_active = 1)";
    replacements.projectId = projectId;
  }
  if (search) {
    where += " AND (e.full_name LIKE :search OR e.employee_code LIKE :search OR e.country_emp_id LIKE :search OR u.email LIKE :search)";
    replacements.search = likePattern(search);
  }
  const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) AS total ${LIST_SQL(where)}`, { replacements });
  const [rows] = await sequelize.query(
    `SELECT e.id, e.employee_code, e.country_emp_id, e.full_name, e.employment_status, e.employment_type, u.email,
            a.status AS account_status, a.access_level, r.id AS role_id, r.name AS role_name,
            p.id AS project_id, p.project_name, p.project_code, s.id AS staffing_id, s.name AS staffing_name
     ${LIST_SQL(where)} ORDER BY e.employee_code ASC, e.id ASC LIMIT :limit OFFSET :offset`,
    { replacements }
  );
  return { items: rows.map(toListItem), total: Number(total), page, limit };
};

// ---------- GET /employees/:id ----------

// The caller's employee, or 404 (also for a malformed id).
const findEmployee = async (employerId, id, options = {}) => {
  const employee = UUID.test(String(id)) ? await Employee.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!employee) throw new ErrorHandler("NOT_FOUND");
  return employee;
};

// Employee-panel logins see only their own profile, whatever their role (D57); admin-panel
// logins need employee:read (the owner always passes).
const assertCanRead = async (auth, id) => {
  if (PANELS.EMPLOYEE.includes(auth.accessLevel)) {
    const own = await Employee.findOne({ where: { user_id: auth.userId, employer_id: auth.employerId }, attributes: ["id"] });
    if (!own || own.id !== id) throw new ErrorHandler("FORBIDDEN");
    return;
  }
  if (auth.accessLevel !== ACCESS_LEVELS.ADMIN && auth.permissions?.employee?.read !== true) throw new ErrorHandler("FORBIDDEN");
};

const projectRef = (p) => (p ? { id: p.id, name: p.project_name, code: p.project_code } : null);

const projectsOf = async (employee) => {
  const rows = await EmployeeProject.findAll({
    where: { employee_id: employee.id },
    include: [{ model: Project, as: "project", attributes: ["id", "project_name", "project_code"] }],
  });
  const toItem = (r) => ({ ...projectRef(r.project), is_main: Boolean(r.main_project), start_date: r.start_date, end_date: r.end_date ?? null });
  const current = rows.filter((r) => r.is_active).sort((a, b) => b.main_project - a.main_project || a.project.project_name.localeCompare(b.project.project_name));
  const past = rows.filter((r) => !r.is_active).sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)));
  const history = await EmployeeProjectHistory.findAll({
    where: { employee_id: employee.id },
    include: [
      { model: Project, as: "project", attributes: ["id", "project_name", "project_code"] },
      { model: Project, as: "previousProject", attributes: ["id", "project_name", "project_code"], required: false },
    ],
    order: [
      ["effective_date", "DESC"],
      ["actioned_at", "DESC"],
      ["id", "ASC"],
    ],
  });
  return {
    current: current.map(toItem),
    past: past.map(toItem),
    history: history.map((h) => ({
      project: projectRef(h.project),
      previous_project: projectRef(h.previousProject),
      action: h.action,
      effective_date: h.effective_date,
      actioned_at: h.actioned_at,
    })),
  };
};

const leavePoliciesOf = async (employee) => {
  const rows = await EmployeeLeavePolicy.findAll({
    where: { employee_id: employee.id },
    include: [{ model: LeavePolicy, as: "leavePolicy", include: [{ model: LeaveType, as: "leaveType", attributes: ["id", "leave_name"] }] }],
    order: [
      ["is_active", "DESC"],
      ["effective_from", "DESC"],
      ["id", "ASC"],
    ],
  });
  return rows.map((r) => ({
    id: r.leavePolicy.id,
    name: r.leavePolicy.policy_name,
    leave_type: ref(r.leavePolicy.leaveType, "leave_name"),
    effective_from: r.effective_from ?? null,
    effective_to: r.effective_to ?? null,
    is_active: Boolean(r.is_active),
  }));
};

const salaryOf = async (employee) => {
  const salary = await EmployeeSalary.findOne({
    where: { employee_id: employee.id, is_active: true },
    include: [
      {
        model: EmployeeSalaryComponent,
        as: "employeeSalaryComponents",
        include: [{ model: SalaryComponent, as: "salaryComponent", attributes: ["id", "name", "code", "type"] }],
      },
    ],
    order: [["effective_from", "DESC"]],
  });
  if (!salary) return null;
  const order = { BASIC: 0, HOUSING: 1, TRANSPORT: 2 };
  const parts = [...salary.employeeSalaryComponents].sort(
    (a, b) => (order[a.salaryComponent.code] ?? 9) - (order[b.salaryComponent.code] ?? 9) || a.salaryComponent.name.localeCompare(b.salaryComponent.name)
  );
  return {
    id: salary.id,
    currency: salary.currency,
    mode: salary.salary_calc_mode,
    working_hours: num(salary.working_hours),
    min_hours: num(salary.min_hours),
    effective_from: salary.effective_from,
    components: parts.map((p) => ({
      component: { id: p.salaryComponent.id, name: p.salaryComponent.name, code: p.salaryComponent.code, type: p.salaryComponent.type },
      calculation_type: p.calculation_type,
      amount: num(p.amount),
      percent_base: typeof p.percent_base === "string" ? JSON.parse(p.percent_base) : p.percent_base ?? null,
    })),
  };
};

const getEmployee = async (auth, id, lang) => {
  const employee = await findEmployee(auth.employerId, id, {
    include: [
      { model: User, as: "user", attributes: ["id", "email", "phone_number", "phone_country"] },
      { model: Country, as: "nationalityCountry", attributes: ["id", "name", "name_ar"], required: false },
      { model: Country, as: "residenceCountry", attributes: ["id", "name", "name_ar"], required: false },
      { model: City, as: "residenceCity", attributes: ["id", "city_name", "name_ar"], required: false },
      { model: Department, as: "department", attributes: ["id", "name"], required: false },
      { model: Designation, as: "designation", attributes: ["id", "name"], required: false },
      { model: StaffingCompany, as: "staffingCompany", attributes: ["id", "name"], required: false },
      { model: CompanyShift, as: "shift", attributes: ["id", "name"], required: false },
    ],
  });
  await assertCanRead(auth, employee.id);
  const account = await HrmsAccount.findOne({
    where: { user_id: employee.user_id, employer_id: auth.employerId },
    include: [{ model: Role, as: "role", attributes: ["id", "name"], required: false }],
  });
  const routing = await EmployeeApprovalRouting.findOne({
    where: { employee_id: employee.id, module_key: "ALL" },
    include: [{ model: ApprovalGroup, as: "approvalGroup", attributes: ["id", "group_name", "group_code"] }],
  });
  const place = (row, key) => (row ? { id: row.id, name: localName(row, lang, key) } : null);
  return {
    overview: {
      id: employee.id,
      employee_code: employee.employee_code,
      country_emp_id: employee.country_emp_id,
      name: employee.full_name,
      email: employee.user.email,
      phone: employee.user.phone_number ?? null,
      phoneCountry: employee.user.phone_country ?? null,
      nationality: place(employee.nationalityCountry, "name"),
      residence_country: place(employee.residenceCountry, "name"),
      residence_city: place(employee.residenceCity, "city_name"),
      dob: employee.dob ?? null,
      gender: employee.gender ?? null,
      address: employee.address ?? null,
      accommodation: employee.accommodation ?? null,
      profile_url: employee.profile_url ?? null,
      employment_type: employee.employment_type,
      employment_status: employee.employment_status,
      joining_date: employee.date_of_joining,
      exit_date: employee.exit_date ?? null,
      access_level: account ? account.access_level : null,
      account_status: account ? account.status : null,
      role: account ? ref(account.role) : null,
      department: ref(employee.department),
      designation: ref(employee.designation),
      staffing_company: ref(employee.staffingCompany),
      overtime_rate: num(employee.overtime_rate),
    },
    projects: await projectsOf(employee),
    shift: ref(employee.shift),
    leave_policies: await leavePoliciesOf(employee),
    salary: await salaryOf(employee),
    approval_group: routing && routing.approvalGroup ? { id: routing.approvalGroup.id, name: routing.approvalGroup.group_name, code: routing.approvalGroup.group_code } : null,
  };
};

// ---------- POST /employees/bulk-status, POST /employees/:id/resend-login ----------

const assertNotExited = (employee) => {
  if (employee.employment_status === "EXITED") throw new ErrorHandler("EMPLOYEE_EXITED");
};

// { employeeIds, status: ACTIVE | SUSPENDED } (D56): all or nothing. Every id must be an employee
// of the company, none EXITED, not the owner. SUSPENDED revokes the account's sessions.
const bulkStatus = async ({ employerId, userId }, { employeeIds, status }) =>
  sequelize.transaction(async (transaction) => {
    if (!employeeIds.every((id) => UUID.test(id))) throw new ErrorHandler("NOT_FOUND");
    const employees = await Employee.findAll({ where: { id: employeeIds, employer_id: employerId }, transaction, lock: transaction.LOCK.UPDATE });
    if (employees.length !== employeeIds.length) throw new ErrorHandler("NOT_FOUND");
    employees.forEach(assertNotExited);
    const employer = await Employer.findByPk(employerId, { attributes: ["user_id"], transaction });
    if (employees.some((e) => e.user_id === employer.user_id)) throw new ErrorHandler("ACCOUNT_OWNER_PROTECTED");

    const accounts = await HrmsAccount.findAll({
      where: { employer_id: employerId, user_id: employees.map((e) => e.user_id), access_level: { [Op.ne]: ACCESS_LEVELS.ADMIN } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    for (const account of accounts) {
      await account.update({ status, updated_by: userId }, { transaction });
      if (status === "SUSPENDED") await revokeSessions({ hrms_account_id: account.id }, transaction);
    }
    return { updated: accounts.length };
  });

// A new temporary password and setup link (or the welcome email for someone with their own
// password), ADR 0003; the previous link stops working.
const resendLogin = async ({ employerId }, id) =>
  sequelize.transaction(async (transaction) => {
    const employee = await findEmployee(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    assertNotExited(employee);
    const account = await HrmsAccount.findOne({ where: { user_id: employee.user_id, employer_id: employerId }, transaction });
    if (!account) throw new ErrorHandler("NOT_FOUND");
    const { temporaryPassword } = await issueLoginCredentials({ userId: employee.user_id, accountId: account.id, transaction });
    return { temporary_password: temporaryPassword };
  });

module.exports = { listEmployees, getEmployee, bulkStatus, resendLogin, findEmployee, assertNotExited };

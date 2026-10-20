const { Op } = require("sequelize");
const {
  sequelize,
  User,
  HrmsAccount,
  Employee,
  EmployeeProject,
  EmployeeProjectHistory,
  EmployeeMainProjectPeriod,
  EmployeeApprovalRouting,
  EmployeeDraft,
  NumberSequence,
  Project,
  Role,
  Country,
  Department,
  Designation,
  StaffingCompany,
  ApprovalGroup,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { clock } = require("../utils/clock");
const { translate } = require("../utils/i18n");
const { COMPANY_COUNTRY_ID } = require("../utils/geoReference");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { UUID } = require("./department.service");
const { companyToday } = require("./companyTime.service");
const { assertCountry, assertCityInCountry } = require("./geo.service");
const { assertEmailFreeForNewAccount, issueLoginCredentials } = require("./credentials.service");

// Creating employees (docs/plans/workforce-and-lifecycle.md D18, D45–D51, D53; ADRs 0002, 0003).
// Always the caller's own company; one transaction, the welcome email after commit.

const MODULE_ALL = "ALL";
const fieldError = (field, key) => new ErrorHandler("VALIDATION_FAILED", { errors: { [field]: key } });

// The caller's row of `Model` by id, or 404 (also for a malformed id).
const findOwn = async (Model, employerId, id, transaction) => {
  const row = UUID.test(String(id)) ? await Model.findOne({ where: { id, employer_id: employerId }, transaction }) : null;
  if (!row) throw new ErrorHandler("NOT_FOUND");
  return row;
};

// ---------- Uniqueness (D45, D46; also GET /employees/check-unique) ----------

const idNumberTaken = async (employerId, countryEmpId, transaction) =>
  Boolean(await Employee.findOne({ where: { employer_id: employerId, country_emp_id: countryEmpId }, attributes: ["id"], paranoid: false, transaction }));

// The email's error code, or null when it's free: anyone with a login or employee record in this
// company → EMPLOYEE_EMAIL_TAKEN; a current account elsewhere → ACCOUNT_EMAIL_IN_OTHER_COMPANY.
const emailClash = async (employerId, email, transaction) => {
  const user = await User.findOne({ where: { email }, attributes: ["id"], paranoid: false, transaction });
  if (user) {
    const here =
      (await HrmsAccount.count({ where: { user_id: user.id, employer_id: employerId }, paranoid: false, transaction })) +
      (await Employee.count({ where: { user_id: user.id, employer_id: employerId }, paranoid: false, transaction }));
    if (here) return "EMPLOYEE_EMAIL_TAKEN";
  }
  try {
    await assertEmailFreeForNewAccount(email, employerId, transaction);
  } catch (err) {
    if (err instanceof ErrorHandler) return err.code;
    throw err;
  }
  return null;
};

// Phones are unique per company only (D46, decided 2026-10-21), compared as E.164.
const phoneTaken = async (employerId, phone, exceptUserId, transaction) =>
  Boolean(
    await Employee.findOne({
      where: { employer_id: employerId },
      attributes: ["id"],
      include: [
        {
          model: User,
          as: "user",
          attributes: [],
          where: { phone_number: phone, ...(exceptUserId ? { id: { [Op.ne]: exceptUserId } } : {}) },
          paranoid: false,
        },
      ],
      paranoid: false,
      transaction,
    })
  );

const assertUnique = async (employerId, { countryEmpId, email, phone }, transaction) => {
  if (await idNumberTaken(employerId, countryEmpId, transaction)) throw new ErrorHandler("EMPLOYEE_ID_NUMBER_TAKEN");
  const emailCode = await emailClash(employerId, email, transaction);
  if (emailCode) throw new ErrorHandler(emailCode);
  if (await phoneTaken(employerId, phone, null, transaction)) throw new ErrorHandler("EMPLOYEE_PHONE_TAKEN");
};

// GET /employees/check-unique: { field: { available } | { available: false, code, message } } for
// each field given.
const checkUnique = async ({ employerId }, query, lang) => {
  const answer = (code) => (code ? { available: false, code, message: translate(code, lang) } : { available: true });
  const result = {};
  if (query.country_emp_id) {
    result.country_emp_id = answer((await idNumberTaken(employerId, query.country_emp_id)) && "EMPLOYEE_ID_NUMBER_TAKEN");
  }
  if (query.email) result.email = answer(await emailClash(employerId, query.email));
  if (query.phone) result.phone = answer((await phoneTaken(employerId, query.phone)) && "EMPLOYEE_PHONE_TAKEN");
  return result;
};

// ---------- Employee ID (D45) ----------

// The company's EMPLOYEE sequence row, locked: also serialises creates within the company, so
// the duplicate checks that follow can't race each other.
const lockSequence = async (employerId, transaction) => {
  await sequelize.query(
    `INSERT IGNORE INTO hrms_number_sequences (id, employer_id, doc_type, financial_year_id, last_no, created_at, updated_at)
     VALUES (UUID(), ?, 'EMPLOYEE', NULL, 0, NOW(), NOW())`,
    { replacements: [employerId], transaction }
  );
  return NumberSequence.findOne({
    where: { employer_id: employerId, doc_type: "EMPLOYEE", financial_year_id: null },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
};

// EMP-0001… per company, never reused; a code already taken (e.g. imported) is skipped.
const nextEmployeeCode = async (seq, employerId, transaction) => {
  let n = seq.last_no;
  let code;
  do {
    n += 1;
    code = `EMP-${String(n).padStart(4, "0")}`;
  } while (await Employee.findOne({ where: { employer_id: employerId, employee_code: code }, paranoid: false, attributes: ["id"], transaction }));
  await seq.update({ last_no: n }, { transaction });
  return code;
};

// ---------- Field checks against the company's data ----------

const addMonths = (iso, months) => {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
};

// Role (D48): required for SUB_ADMIN, else optional; must be a company role.
const checkAccess = async (auth, body, transaction) => {
  if (body.accessLevel === ACCESS_LEVELS.ADMIN) throw new ErrorHandler("ACCOUNT_ADMIN_EXISTS");
  if (body.accessLevel === ACCESS_LEVELS.SUB_ADMIN) {
    if (auth.accessLevel !== ACCESS_LEVELS.ADMIN) throw new ErrorHandler("FORBIDDEN");
    if (!body.roleId) throw fieldError("roleId", "roleRequired");
  }
  return body.roleId ? findOwn(Role, auth.employerId, body.roleId, transaction) : null;
};

// Projects and joining date (D49).
const checkProjects = async (employerId, body, today, transaction) => {
  const { projectIds, mainProjectId } = body;
  if (!projectIds.includes(mainProjectId)) throw fieldError("mainProjectId", "mainProjectInSelection");
  if (body.accessLevel === ACCESS_LEVELS.GENERAL_EMPLOYEE && projectIds.length > 1) throw fieldError("projectIds", "generalOneProject");
  if (!projectIds.every((id) => UUID.test(id))) throw new ErrorHandler("NOT_FOUND");
  const projects = await Project.findAll({ where: { id: projectIds, employer_id: employerId }, transaction, lock: transaction.LOCK.SHARE });
  if (projects.length !== projectIds.length) throw new ErrorHandler("NOT_FOUND");
  if (projects.some((p) => p.status !== "ACTIVE")) throw fieldError("projectIds", "projectsActiveOnly");

  const main = projects.find((p) => p.id === mainProjectId);
  const joiningDate = body.joiningDate || today;
  if (joiningDate > addMonths(today, 12)) throw fieldError("joiningDate", "joiningTooFar");
  if (main.start_date && joiningDate < main.start_date) throw fieldError("joiningDate", "joiningBeforeProjectStart");
  return { projects, main, joiningDate };
};

// Nationality and residence (countries-cities-phones D12–D14).
const checkPlaces = async (body, transaction) => {
  const nationality = UUID.test(String(body.nationalityCountryId))
    ? await Country.findOne({ where: { id: body.nationalityCountryId, is_active: true }, attributes: ["id"], transaction })
    : null;
  if (!nationality) throw fieldError("nationalityCountryId", "nationalityRequired");
  const residence = await assertCountry(body.residenceCountryId || COMPANY_COUNTRY_ID, "residenceCountryId", { transaction });
  await assertCityInCountry(body.residenceCityId, residence.id, "residenceCityId", { transaction });
  return { nationalityId: nationality.id, residenceCountryId: residence.id, residenceCityId: body.residenceCityId || null };
};

// Department, designation, staffing company (D50).
const checkJob = async (employerId, body, transaction) => {
  const department = body.departmentId ? await findOwn(Department, employerId, body.departmentId, transaction) : null;
  if (department && department.status !== "ACTIVE") throw fieldError("departmentId", "departmentActive");
  if (body.designationId) {
    const designation = await findOwn(Designation, employerId, body.designationId, transaction);
    if (!department || designation.department_id !== department.id || designation.status !== "ACTIVE") {
      throw fieldError("designationId", "designationActive");
    }
  }
  if (body.staffingCompanyId) {
    const staffing = await findOwn(StaffingCompany, employerId, body.staffingCompanyId, transaction);
    if (body.employmentType !== "CONTRACT") throw fieldError("staffingCompanyId", "staffingContractOnly");
    if (staffing.status !== "ACTIVE") throw fieldError("staffingCompanyId", "staffingActive");
  }
};

// Approval group (D18, D51): required once the company has an active group; an unknown or
// inactive one is the same field error; a PROJECT group must be the main project's.
const checkApprovalGroup = async (employerId, body, mainProjectId, transaction) => {
  if (body.moduleKey !== MODULE_ALL) throw new ErrorHandler("APPROVAL_ROUTING_PER_MODULE_DISABLED");
  if (!body.approvalGroupId) {
    const anyActive = await ApprovalGroup.count({ where: { employer_id: employerId, is_active: true }, transaction });
    if (anyActive) throw fieldError("approvalGroupId", "approvalGroupRequired");
    return null;
  }
  const group = UUID.test(String(body.approvalGroupId))
    ? await ApprovalGroup.findOne({ where: { id: body.approvalGroupId, employer_id: employerId, is_active: true }, transaction })
    : null;
  if (!group) throw fieldError("approvalGroupId", "approvalGroupRequired");
  if (group.scope === "PROJECT" && group.project_id !== mainProjectId) throw new ErrorHandler("APPROVAL_GROUP_PROJECT_MISMATCH");
  return group;
};

// ---------- POST /employees ----------

const toCreated = ({ employee, user, account, main, group }) => ({
  id: employee.id,
  employee_code: employee.employee_code,
  name: employee.full_name,
  email: user.email,
  phone: user.phone_number,
  phoneCountry: user.phone_country,
  access_level: account.access_level,
  role_id: account.role_id ?? null,
  employment_type: employee.employment_type,
  employment_status: employee.employment_status,
  joining_date: employee.date_of_joining,
  main_project_id: main.id,
  approval_group_id: group ? group.id : null,
});

// The person's users row (ADR 0002: someone whose accounts elsewhere have ended keeps theirs and
// gets a new account here), with this employee's name for a new person and the phone either way.
const personFor = async (body, transaction) => {
  const existing = await User.findOne({ where: { email: body.email }, paranoid: false, transaction, lock: transaction.LOCK.UPDATE });
  if (!existing) {
    return User.create({ name: body.name, email: body.email, phone_number: body.phone, phone_country: body.phoneCountry }, { transaction });
  }
  if (existing.deleted_at) await existing.restore({ transaction });
  await existing.update({ phone_number: body.phone, phone_country: body.phoneCountry }, { transaction });
  return existing;
};

const createEmployee = async (auth, body) => {
  const { employerId, userId } = auth;
  return sequelize.transaction(async (transaction) => {
    const seq = await lockSequence(employerId, transaction);
    const role = await checkAccess(auth, body, transaction);
    const today = await companyToday(employerId, { transaction });
    const { projects, main, joiningDate } = await checkProjects(employerId, body, today, transaction);
    const places = await checkPlaces(body, transaction);
    await checkJob(employerId, body, transaction);
    const group = await checkApprovalGroup(employerId, body, main.id, transaction);
    const draft = body.draft_id ? await findOwn(EmployeeDraft, employerId, body.draft_id, transaction) : null;
    await assertUnique(employerId, { countryEmpId: body.country_emp_id, email: body.email, phone: body.phone }, transaction);

    const user = await personFor(body, transaction);
    const now = clock.now();
    const account = await HrmsAccount.create(
      {
        user_id: user.id,
        employer_id: employerId,
        access_level: body.accessLevel,
        role_id: role ? role.id : null,
        status: "ACTIVE",
        invited_by: userId,
        invited_at: now,
        created_by: userId,
        updated_by: userId,
      },
      { transaction }
    );
    const employee = await saveOrClash(
      async () =>
        Employee.create(
          {
            user_id: user.id,
            employer_id: employerId,
            employee_code: await nextEmployeeCode(seq, employerId, transaction),
            country_emp_id: body.country_emp_id,
            full_name: body.name,
            nationality_country_id: places.nationalityId,
            residence_country_id: places.residenceCountryId,
            residence_city_id: places.residenceCityId,
            dob: body.dob || null,
            gender: body.gender || null,
            address: body.address || null,
            accommodation: body.accommodation || null,
            employment_type: body.employmentType,
            employment_status: "ACTIVE",
            date_of_joining: joiningDate,
            department_id: body.departmentId || null,
            designation_id: body.designationId || null,
            staffing_company_id: body.staffingCompanyId || null,
          },
          { transaction }
        ),
      { uq_employees_employer_id_country_emp_id: "EMPLOYEE_ID_NUMBER_TAKEN" }
    );

    // Assignments start on the joining date with ASSIGNED rows; the main period starts then (D49).
    for (const project of projects) {
      const isMain = project.id === main.id;
      await EmployeeProject.create(
        {
          employer_id: employerId,
          employee_id: employee.id,
          project_id: project.id,
          is_active: true,
          start_date: joiningDate,
          main_project: isMain,
          main_project_date_start: isMain ? joiningDate : null,
        },
        { transaction }
      );
      await EmployeeProjectHistory.create(
        {
          employer_id: employerId,
          employee_id: employee.id,
          project_id: project.id,
          action: "ASSIGNED",
          effective_date: joiningDate,
          actioned_by: userId,
          actioned_at: now,
        },
        { transaction }
      );
    }
    await EmployeeMainProjectPeriod.create(
      { employer_id: employerId, employee_id: employee.id, project_id: main.id, date_from: joiningDate },
      { transaction }
    );
    if (group) {
      await EmployeeApprovalRouting.create(
        { employer_id: employerId, employee_id: employee.id, module_key: MODULE_ALL, approval_group_id: group.id },
        { transaction }
      );
    }
    if (draft) await draft.destroy({ transaction });

    await issueLoginCredentials({ userId: user.id, accountId: account.id, transaction });
    return toCreated({ employee, user, account, main, group });
  });
};

module.exports = { createEmployee, checkUnique, findOwn, emailClash, phoneTaken, idNumberTaken };

const { Op } = require("sequelize");
const { sequelize, Employee, StaffingCompany } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { likePattern } = require("./department.service");
const { AUDIENCES, SUPPORTED_AUDIENCES, employeesActive, staffingCompaniesActive, mainProjects } = require("./contractParties.service");

// GET /contract-recipients: the send wizard's read-only picker (plan decision 20, ADR 0008).
// Inactive recipients (decision 41) are listed and marked, never hidden. Deleted rows are
// included for that reason.

const assertAudience = (audience) => {
  if (!SUPPORTED_AUDIENCES.includes(audience)) throw new ErrorHandler("CONTRACT_AUDIENCE_UNSUPPORTED");
};

const status = (active) => (active ? "ACTIVE" : "INACTIVE");

const listEmployees = async (employerId, { projectId, staffingCompanyId, q, page, limit }) => {
  const where = { employer_id: employerId };
  if (staffingCompanyId) where.staffing_company_id = staffingCompanyId;
  if (q) {
    const pattern = likePattern(q);
    where[Op.or] = [{ full_name: { [Op.like]: pattern } }, { country_emp_id: { [Op.like]: pattern } }];
  }
  if (projectId) {
    // Any ACTIVE assignment on the project, main or not (decision 20).
    where.id = {
      [Op.in]: sequelize.literal(
        `(SELECT ep.employee_id FROM employee_projects ep WHERE ep.employer_id = ${sequelize.escape(employerId)} ` +
          `AND ep.project_id = ${sequelize.escape(projectId)} AND ep.is_active = 1)`
      ),
    };
  }

  const { count, rows } = await Employee.findAndCountAll({
    where,
    paranoid: false,
    include: [{ model: StaffingCompany, as: "staffingCompany", attributes: ["id", "name"], paranoid: false }],
    order: [
      ["full_name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  const [active, projects] = await Promise.all([
    employeesActive(employerId, rows),
    mainProjects(
      employerId,
      rows.map((r) => r.id)
    ),
  ]);

  const items = rows.map((e) => {
    const project = projects.get(e.id);
    return {
      id: e.id,
      name: e.full_name,
      code: e.country_emp_id,
      project: project ? { id: project.id, name: project.project_name } : null,
      staffingCompany: e.staffingCompany ? { id: e.staffingCompany.id, name: e.staffingCompany.name } : null,
      status: status(active.get(e.id)),
    };
  });
  return { items, total: count, page, limit };
};

const listStaffingCompanies = async (employerId, { q, page, limit }) => {
  const where = { employer_id: employerId };
  if (q) {
    const pattern = likePattern(q);
    where[Op.or] = [{ name: { [Op.like]: pattern } }, { code: { [Op.like]: pattern } }];
  }
  const { count, rows } = await StaffingCompany.findAndCountAll({
    where,
    paranoid: false,
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  const active = await staffingCompaniesActive(employerId, rows);
  const items = rows.map((c) => ({ id: c.id, name: c.name, code: c.code, status: status(active.get(c.id)) }));
  return { items, total: count, page, limit };
};

const lookupRecipients = async ({ employerId }, query) => {
  assertAudience(query.audience);
  return query.audience === AUDIENCES.EMPLOYEE ? listEmployees(employerId, query) : listStaffingCompanies(employerId, query);
};

module.exports = { lookupRecipients, assertAudience };

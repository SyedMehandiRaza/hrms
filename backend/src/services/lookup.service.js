const { Role, StaffingCompany } = require("../models");

// Read-only lookups for the employee wizard and edit modal (workforce D48). The full Roles and
// Staffing companies modules are planned separately.

// GET /roles: the company's roles, by name.
const listRoles = async ({ employerId }) => {
  const rows = await Role.findAll({
    where: { employer_id: employerId },
    attributes: ["id", "name"],
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
};

// GET /staffing-companies?status=: the company's staffing companies, by name.
const listStaffingCompanies = async ({ employerId }, { status }) => {
  const where = { employer_id: employerId };
  if (status) where.status = status;
  const rows = await StaffingCompany.findAll({
    where,
    attributes: ["id", "name", "code"],
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
  });
  return rows.map((s) => ({ id: s.id, name: s.name, code: s.code ?? null }));
};

module.exports = { listRoles, listStaffingCompanies };

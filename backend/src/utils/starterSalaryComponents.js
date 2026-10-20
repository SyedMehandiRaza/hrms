const crypto = require("crypto");

// The salary components every company has (docs/plans/workforce-and-lifecycle.md D42).
// Defaults (Basic, Housing, Transport) are the wizard's locked first rows in monthly modes;
// defaults and Hourly are system components (no edit or deactivate). Raw SQL so the data
// migration doesn't depend on models.
// [code, name, type, is_default, is_system]
const STARTER_SALARY_COMPONENTS = [
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

// Gives the company every starter component it doesn't have yet. A code or a name the company
// already uses (any case) is skipped, so re-running adds nothing. `idFor(code)` picks row ids
// (the seeder uses its deterministic ids). Returns the codes added.
const addStarterSalaryComponents = async (sequelize, employerId, { transaction, idFor = () => crypto.randomUUID() } = {}) => {
  const existing = await sequelize.query("SELECT code, name FROM hrms_salary_components WHERE employer_id = ?", {
    replacements: [employerId],
    transaction,
    type: sequelize.QueryTypes.SELECT,
  });
  const codes = new Set(existing.map((r) => String(r.code || "").toUpperCase()));
  const names = new Set(existing.map((r) => String(r.name || "").toLowerCase()));
  const missing = STARTER_SALARY_COMPONENTS.filter(([code, name]) => !codes.has(code) && !names.has(name.toLowerCase()));
  if (!missing.length) return [];

  const now = new Date();
  await sequelize.query(
    `INSERT INTO hrms_salary_components (id, employer_id, code, name, type, is_default, is_system, is_active, created_at, updated_at)
     VALUES ${missing.map(() => "(?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").join(", ")}`,
    {
      replacements: missing.flatMap(([code, name, type, isDefault, isSystem]) => [
        idFor(code),
        employerId,
        code,
        name,
        type,
        isDefault,
        isSystem,
        now,
        now,
      ]),
      transaction,
    }
  );
  return missing.map(([code]) => code);
};

module.exports = { STARTER_SALARY_COMPONENTS, addStarterSalaryComponents };

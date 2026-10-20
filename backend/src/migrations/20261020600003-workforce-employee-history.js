"use strict";

// Employee history and salary components (docs/plans/workforce-and-lifecycle.md D42, D55, §3):
// project history rows carry the date they take effect; main-project periods record which
// project was an employee's main one on each day; shift history carries employer_id (backfilled
// from the employee); salary components get is_default (the wizard's locked first rows).

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("hrms_employee_project_history", "effective_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: "action",
    });

    await queryInterface.createTable(
      "hrms_employee_main_project_periods",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        date_from: { type: Sequelize.DATEONLY, allowNull: false },
        date_to: { type: Sequelize.DATEONLY, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_main_project_periods", ["employee_id", "date_from"], {
      name: "ix_hrms_employee_main_project_periods_employee_id_date_from",
    });
    await queryInterface.addIndex("hrms_employee_main_project_periods", ["employer_id", "project_id"], {
      name: "ix_hrms_employee_main_project_periods_employer_id_project_id",
    });

    await queryInterface.addColumn("hrms_employee_shift_history", "employer_id", {
      type: Sequelize.UUID,
      allowNull: true,
      after: "id",
      references: { model: "employers", key: "id" },
      onDelete: "CASCADE",
    });
    await queryInterface.sequelize.query(
      "UPDATE hrms_employee_shift_history h JOIN employees e ON e.id = h.employee_id SET h.employer_id = e.employer_id"
    );
    await queryInterface.sequelize.query("ALTER TABLE `hrms_employee_shift_history` MODIFY employer_id CHAR(36) BINARY NOT NULL");

    await queryInterface.addColumn("hrms_salary_components", "is_default", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "is_system",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("hrms_salary_components", "is_default");
    await queryInterface.removeColumn("hrms_employee_shift_history", "employer_id");
    await queryInterface.dropTable("hrms_employee_main_project_periods");
    await queryInterface.removeColumn("hrms_employee_project_history", "effective_date");
  },
};

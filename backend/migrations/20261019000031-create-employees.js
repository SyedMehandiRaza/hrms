"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "employees",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_code: { type: Sequelize.STRING(30), allowNull: false },
        country_emp_id: { type: Sequelize.STRING(20), allowNull: false },
        full_name: { type: Sequelize.STRING(255), allowNull: false },
        nationality: { type: Sequelize.STRING(100), allowNull: true },
        dob: { type: Sequelize.DATEONLY, allowNull: true },
        gender: { type: Sequelize.ENUM("MALE", "FEMALE", "OTHER"), allowNull: true },
        address: { type: Sequelize.TEXT, allowNull: true },
        accommodation: { type: Sequelize.STRING(255), allowNull: true },
        profile_url: { type: Sequelize.TEXT, allowNull: true },
        employment_type: { type: Sequelize.ENUM("FULL_TIME", "CONTRACT"), allowNull: true },
        employment_status: { type: Sequelize.ENUM("ACTIVE", "IN_NOTICE", "EXITED"), allowNull: false, defaultValue: "ACTIVE" },
        date_of_joining: { type: Sequelize.DATEONLY, allowNull: true },
        exit_date: { type: Sequelize.DATEONLY, allowNull: true },
        department_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_departments", key: "id" }, onDelete: "SET NULL" },
        designation_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_designations", key: "id" }, onDelete: "SET NULL" },
        shift_id: { type: Sequelize.UUID, allowNull: true, references: { model: "company_shifts", key: "id" }, onDelete: "SET NULL" },
        office_id: { type: Sequelize.UUID, allowNull: true, references: { model: "offices", key: "id" }, onDelete: "SET NULL" },
        staffing_company_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_staffing_companies", key: "id" }, onDelete: "SET NULL" },
        overtime_rate: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 1.5 },
        is_billable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        signature_url: { type: Sequelize.STRING(512), allowNull: true },
        signature_type: { type: Sequelize.ENUM("DRAWN", "TYPED", "UPLOADED"), allowNull: true },
        signature_updated_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("employees", ["employer_id","employee_code"], { unique: true, name: "uq_employees_employer_id_employee_code" });
    await queryInterface.addIndex("employees", ["employer_id","country_emp_id"], { unique: true, name: "uq_employees_employer_id_country_emp_id" });
    await queryInterface.addIndex("employees", ["employer_id","employment_status"], { name: "ix_employees_employer_id_employment_status" });
    await queryInterface.addIndex("employees", ["full_name"], { name: "ix_employees_full_name" });
    await queryInterface.addIndex("employees", ["employment_type"], { name: "ix_employees_employment_type" });
    // Circular FK declared on hrms_departments; added once employees exists.
    await queryInterface.addConstraint("hrms_departments", {
      fields: ["dept_head_id"],
      type: "foreign key",
      name: "fk_hrms_departments_dept_head_id",
      references: { table: "employees", field: "id" },
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("hrms_departments", "fk_hrms_departments_dept_head_id");
    await queryInterface.dropTable("employees");
  },
};

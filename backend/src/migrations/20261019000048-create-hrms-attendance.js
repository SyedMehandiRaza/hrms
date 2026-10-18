"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_attendance",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        work_date: { type: Sequelize.DATEONLY, allowNull: false },
        check_in_time: { type: Sequelize.DATE, allowNull: false },
        check_in_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
        check_in_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
        check_in_photo: { type: Sequelize.TEXT, allowNull: true },
        check_out_time: { type: Sequelize.DATE, allowNull: true },
        check_out_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        check_out_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        is_within_geofence: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        source: { type: Sequelize.ENUM("ONLINE", "OFFLINE"), allowNull: false, defaultValue: "ONLINE" },
        client_event_id: { type: Sequelize.STRING(100), allowNull: true },
        synced_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_attendance", ["employee_id","client_event_id"], { unique: true, name: "uq_hrms_attendance_employee_id_client_event_id" });
    await queryInterface.addIndex("hrms_attendance", ["employee_id","work_date"], { name: "ix_hrms_attendance_employee_id_work_date" });
    await queryInterface.addIndex("hrms_attendance", ["project_id","work_date"], { name: "ix_hrms_attendance_project_id_work_date" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_attendance");
  },
};

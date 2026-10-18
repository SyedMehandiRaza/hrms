"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_holidays",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        city_id: { type: Sequelize.UUID, allowNull: true, references: { model: "cities", key: "id" }, onDelete: "SET NULL" },
        holiday_name: { type: Sequelize.STRING(200), allowNull: false },
        holiday_date: { type: Sequelize.DATEONLY, allowNull: false },
        holiday_type: { type: Sequelize.ENUM("PUBLIC", "FESTIVAL", "NATIONAL", "COMPANY", "OPTIONAL", "WEEKLY_OFF"), allowNull: false, defaultValue: "PUBLIC" },
        is_global: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_optional: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_half_day: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        from_time: { type: Sequelize.TIME, allowNull: true },
        to_time: { type: Sequelize.TIME, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        source_holiday_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_holidays", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_holidays` ADD COLUMN city_key CHAR(36) GENERATED ALWAYS AS (IFNULL(city_id, '')) VIRTUAL"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_holidays` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(is_active = 1 AND deleted_at IS NULL, 1, NULL)) STORED"
    );
    await queryInterface.addIndex("hrms_holidays", ["employer_id","holiday_date","city_key","live_key"], { unique: true, name: "uq_hrms_holidays_employer_id_holiday_date_city_key_live_key" });
    await queryInterface.addIndex("hrms_holidays", ["holiday_date"], { name: "ix_hrms_holidays_holiday_date" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_holidays");
  },
};

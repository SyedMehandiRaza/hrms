"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExitVisaTrip = sequelize.define(
    "ExitVisaTrip",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      exit_visa_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_exit_visas", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      departure_date: { type: DataTypes.DATEONLY, allowNull: false },
      expected_return_date: { type: DataTypes.DATEONLY },
      actual_return_date: { type: DataTypes.DATEONLY },
      status: { type: DataTypes.ENUM("PENDING_APPROVAL", "PLANNED", "DEPARTED", "RETURNED", "OVERSTAYED", "CANCELLED", "REJECTED"), allowNull: false, defaultValue: "PENDING_APPROVAL" },
      notes: { type: DataTypes.TEXT },
      recorded_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      approved_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_exit_visa_trips",
      underscored: true,
    }
  );

  ExitVisaTrip.associate = (models) => {
    ExitVisaTrip.belongsTo(models.ExitVisa, { as: "exitVisa", foreignKey: "exit_visa_id" });
    ExitVisaTrip.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ExitVisaTrip.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    ExitVisaTrip.belongsTo(models.User, { as: "recordedBy", foreignKey: "recorded_by" });
    ExitVisaTrip.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by" });
  };

  return ExitVisaTrip;
};

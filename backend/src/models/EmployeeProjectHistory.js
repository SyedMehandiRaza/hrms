"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeProjectHistory = sequelize.define(
    "EmployeeProjectHistory",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      previous_project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      action: { type: DataTypes.ENUM("ASSIGNED", "REMOVED", "MOVED_IN", "MOVED_OUT"), allowNull: false },
      actioned_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      notes: { type: DataTypes.TEXT },
      actioned_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "hrms_employee_project_history",
      underscored: true,
      updatedAt: false,
    }
  );

  EmployeeProjectHistory.associate = (models) => {
    EmployeeProjectHistory.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeProjectHistory.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeProjectHistory.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    EmployeeProjectHistory.belongsTo(models.Project, { as: "previousProject", foreignKey: "previous_project_id" });
    EmployeeProjectHistory.belongsTo(models.User, { as: "actionedBy", foreignKey: "actioned_by" });
  };

  return EmployeeProjectHistory;
};

"use strict";

module.exports = (sequelize, DataTypes) => {
  const StaffingCompanyProject = sequelize.define(
    "StaffingCompanyProject",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      staffing_company_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_staffing_companies", key: "id" } },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_staffing_company_projects",
      underscored: true,
    }
  );

  StaffingCompanyProject.associate = (models) => {
    StaffingCompanyProject.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    StaffingCompanyProject.belongsTo(models.StaffingCompany, { as: "staffingCompany", foreignKey: "staffing_company_id" });
    StaffingCompanyProject.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
  };

  return StaffingCompanyProject;
};

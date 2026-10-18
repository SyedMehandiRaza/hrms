"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExitDocument = sequelize.define(
    "ExitDocument",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      exit_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_employee_exits", key: "id" } },
      doc_type: { type: DataTypes.ENUM("TERMINATION_LETTER", "RELIEVING_LETTER", "FNF_STATEMENT", "CLEARANCE_CERTIFICATE"), allowNull: false },
      storage_key: { type: DataTypes.STRING(500), allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      is_final: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      generated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      generated_at: { type: DataTypes.DATE, allowNull: false },
      sent_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_exit_documents",
      underscored: true,
    }
  );

  ExitDocument.associate = (models) => {
    ExitDocument.belongsTo(models.EmployeeExit, { as: "exit", foreignKey: "exit_id" });
    ExitDocument.belongsTo(models.User, { as: "generatedBy", foreignKey: "generated_by" });
  };

  return ExitDocument;
};

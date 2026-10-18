"use strict";

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" } },
      type: { type: DataTypes.STRING(60), allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      body: { type: DataTypes.TEXT },
      entity_type: { type: DataTypes.STRING(100) },
      entity_id: { type: DataTypes.CHAR(36) },
      read_at: { type: DataTypes.DATE },
    },
    {
      tableName: "notifications",
      underscored: true,
    }
  );

  Notification.associate = (models) => {
    Notification.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Notification.belongsTo(models.User, { as: "user", foreignKey: "user_id" });
  };

  return Notification;
};

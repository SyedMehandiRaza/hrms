"use strict";

const { seedId } = require("../utils/seed");

// Exits (docs/plans/workforce-and-lifecycle.md D58–D60, D29, §3): an exit waits for approval
// (PENDING_APPROVAL, the new default) and can be REJECTED; it links to its approval request and
// keeps the rejection reason. Exit events gain APPROVED, REJECTED and WITHDRAWN. The new `exit`
// permission module exists (Exit list/detail, Exit settings); the seeded Sub Admin role, built
// from every module with create/read/update, gets it too when it exists.

const STATUSES_OLD = ["IN_NOTICE", "EXITED", "COMPLETED", "CANCELLED"];
const STATUSES_NEW = ["PENDING_APPROVAL", "IN_NOTICE", "EXITED", "COMPLETED", "CANCELLED", "REJECTED"];
const EVENTS_OLD = [
  "RAISED",
  "TERMS_UPDATED",
  "LWD_EXTENDED",
  "LWD_REVERTED",
  "CHECKLIST_UPDATED",
  "ITEM_ADDED",
  "SETTLEMENT_POSTED",
  "ADJUSTMENT_ADDED",
  "EXITED",
  "COMPLETED",
  "CANCELLED",
  "REHIRED",
  "CONFIRMED",
  "CONFIRMED_WITH_OVERRIDE",
  "RELIEVED_EARLY",
  "DOCUMENT_GENERATED",
  "DOCUMENT_SENT",
  "CLEARANCE_UPLOADED",
];
const EVENTS_NEW = [...EVENTS_OLD, "APPROVED", "REJECTED", "WITHDRAWN"];

const EXIT_MODULE_ID = seedId("module:exit");
const SUB_ADMIN_ROLE = seedId("role:sub-admin");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    await queryInterface.changeColumn("hrms_employee_exits", "status", {
      type: Sequelize.ENUM(...STATUSES_NEW),
      allowNull: false,
      defaultValue: "PENDING_APPROVAL",
    });
    await queryInterface.addColumn("hrms_employee_exits", "approval_request_id", {
      type: Sequelize.UUID,
      allowNull: true,
      after: "status",
      references: { model: "hrms_approval_requests", key: "id" },
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("hrms_employee_exits", "reject_reason", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "approval_request_id",
    });
    await queryInterface.changeColumn("hrms_exit_events", "event_type", { type: Sequelize.ENUM(...EVENTS_NEW), allowNull: false });

    const now = new Date();
    const [[{ n }]] = await q("SELECT COALESCE(MAX(sort_order), 0) AS n FROM modules");
    await q("INSERT IGNORE INTO modules (id, module_key, name, sort_order, created_at, updated_at) VALUES (?, 'exit', 'Exits', ?, ?, ?)", [
      EXIT_MODULE_ID,
      Number(n) + 1,
      now,
      now,
    ]);
    const [[mod]] = await q("SELECT id FROM modules WHERE module_key = 'exit'");
    const [roles] = await q("SELECT id FROM roles WHERE id = ?", [SUB_ADMIN_ROLE]);
    if (roles.length) {
      await q(
        "INSERT IGNORE INTO role_permissions (id, role_id, module_id, can_read, can_create, can_update, can_delete, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1, 0, ?, ?)",
        [seedId("role-perm:sub-admin:exit"), SUB_ADMIN_ROLE, mod.id, now, now]
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q("DELETE rp FROM role_permissions rp JOIN modules m ON m.id = rp.module_id WHERE m.module_key = 'exit'");
    await q("DELETE FROM modules WHERE module_key = 'exit'");
    await q("DELETE FROM hrms_exit_events WHERE event_type IN ('APPROVED', 'REJECTED', 'WITHDRAWN')");
    await queryInterface.changeColumn("hrms_exit_events", "event_type", { type: Sequelize.ENUM(...EVENTS_OLD), allowNull: false });
    await queryInterface.removeColumn("hrms_employee_exits", "reject_reason");
    await queryInterface.removeColumn("hrms_employee_exits", "approval_request_id");
    await q("DELETE FROM hrms_employee_exits WHERE status IN ('PENDING_APPROVAL', 'REJECTED')");
    await queryInterface.changeColumn("hrms_employee_exits", "status", {
      type: Sequelize.ENUM(...STATUSES_OLD),
      allowNull: false,
      defaultValue: "IN_NOTICE",
    });
  },
};

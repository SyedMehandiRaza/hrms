"use strict";

// Approvals (docs/plans/workforce-and-lifecycle.md D17–D19, D27, §3, ADR 0011):
// - groups aren't tied to a module: module_key = 'ALL'; names unique per company, including
//   inactive groups (groups are never deleted, so no live_key). Duplicates get " (2)", " (3)"…;
// - the owner has no employee record, so a request records its raiser as a user
//   (requested_by_user_id, backfilled from the employee) and requested_by becomes optional;
// - log rows carry the acting user and whether it was an owner override; the member and
//   employee are optional (override and owner-only rows).

const freeName = (base, taken) => {
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, 150 - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });

    const [groups] = await q("SELECT id, employer_id, group_name FROM hrms_approval_groups ORDER BY created_at, id");
    const names = new Map();
    for (const g of groups) {
      if (!names.has(g.employer_id)) names.set(g.employer_id, new Set());
      const taken = names.get(g.employer_id);
      if (!taken.has(g.group_name.toLowerCase())) {
        taken.add(g.group_name.toLowerCase());
        continue;
      }
      const name = freeName(g.group_name, taken);
      await q("UPDATE hrms_approval_groups SET group_name = ? WHERE id = ?", [name, g.id]);
      console.log(`[workforce] approval group ${g.id}: duplicate name "${g.group_name}" renamed to "${name}"`);
    }
    await q("UPDATE hrms_approval_groups SET module_key = 'ALL'");
    await queryInterface.addIndex("hrms_approval_groups", ["employer_id", "group_name"], {
      unique: true,
      name: "uq_hrms_approval_groups_employer_id_group_name",
    });

    await queryInterface.addColumn("hrms_approval_requests", "requested_by_user_id", {
      type: Sequelize.UUID,
      allowNull: true,
      after: "requested_by",
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    });
    await q("UPDATE hrms_approval_requests r JOIN employees e ON e.id = r.requested_by SET r.requested_by_user_id = e.user_id");
    await q("ALTER TABLE `hrms_approval_requests` MODIFY requested_by_user_id CHAR(36) BINARY NOT NULL");
    await q("ALTER TABLE `hrms_approval_requests` MODIFY requested_by CHAR(36) BINARY NULL");

    await queryInterface.addColumn("hrms_approval_request_logs", "actor_user_id", {
      type: Sequelize.UUID,
      allowNull: true,
      after: "employee_id",
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("hrms_approval_request_logs", "is_override", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "actor_user_id",
    });
    await q("ALTER TABLE `hrms_approval_request_logs` MODIFY approval_group_member_id CHAR(36) BINARY NULL");
    await q("ALTER TABLE `hrms_approval_request_logs` MODIFY employee_id CHAR(36) BINARY NULL");
  },

  // Rows that only the new columns can describe (owner-only/override rows, owner-raised
  // requests) can't survive the old NOT NULL columns and are removed.
  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q("DELETE FROM hrms_approval_request_logs WHERE approval_group_member_id IS NULL OR employee_id IS NULL");
    await q("ALTER TABLE `hrms_approval_request_logs` MODIFY employee_id CHAR(36) BINARY NOT NULL");
    await q("ALTER TABLE `hrms_approval_request_logs` MODIFY approval_group_member_id CHAR(36) BINARY NOT NULL");
    await queryInterface.removeColumn("hrms_approval_request_logs", "is_override");
    await queryInterface.removeColumn("hrms_approval_request_logs", "actor_user_id");

    await q("DELETE FROM hrms_approval_requests WHERE requested_by IS NULL");
    await q("ALTER TABLE `hrms_approval_requests` MODIFY requested_by CHAR(36) BINARY NOT NULL");
    await queryInterface.removeColumn("hrms_approval_requests", "requested_by_user_id");

    await queryInterface.removeIndex("hrms_approval_groups", "uq_hrms_approval_groups_employer_id_group_name");
  },
};

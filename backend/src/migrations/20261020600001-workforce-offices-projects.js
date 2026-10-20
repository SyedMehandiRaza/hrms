"use strict";

const crypto = require("crypto");
const { setForeignKey, addIndexOnce } = require("../utils/migrations");

// Head offices and projects (docs/plans/workforce-and-lifecycle.md D1–D12, §3, ADR 0010):
// a project belongs to exactly one head office and a head office has at most one project
// (projects.office_id NOT NULL + unique); offices.status is gone (derived); project status is
// ACTIVE | ON_HOLD | COMPLETED (INACTIVE → ON_HOLD); office and project names are unique per
// company among live rows (live_key, NULL once soft-deleted).
//
// Existing data is made to fit and every change is reported:
// - an office with several projects keeps the oldest; each other project gets a copy of the
//   office named "<name> (2)", "(3)"…;
// - a project with no office gets a new office named after the project;
// - duplicate live office/project names get " (2)", " (3)"… in creation order.

const OFFICE_COPY_COLUMNS = [
  "employer_id",
  "office_email",
  "office_phone",
  "phone_country",
  "office_location",
  "lat",
  "lng",
  "office_image",
  "country_id",
  "city_id",
];

// A name not used by a live row of the company: "<base> (n)" with n from 2.
const freeName = (base, taken, max) => {
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, max - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }
};

const fitData = async (sequelize, transaction) => {
  const select = (sql, replacements) => sequelize.query(sql, { replacements, transaction, type: sequelize.QueryTypes.SELECT });
  const exec = (sql, replacements) => sequelize.query(sql, { replacements, transaction });
  const report = [];
  const now = new Date();

  const officeNames = new Map(); // employer_id → Set of lowercased live office names
  const liveOfficeNames = async (employerId) => {
    if (!officeNames.has(employerId)) {
      const rows = await select("SELECT office_name FROM offices WHERE employer_id = ? AND deleted_at IS NULL", [employerId]);
      officeNames.set(employerId, new Set(rows.map((r) => r.office_name.toLowerCase())));
    }
    return officeNames.get(employerId);
  };

  // Duplicate live office names (any case): the first keeps its name.
  const offices = await select("SELECT id, employer_id, office_name FROM offices WHERE deleted_at IS NULL ORDER BY created_at, id");
  const seenOffice = new Map();
  for (const o of offices) {
    const key = `${o.employer_id}|${o.office_name.toLowerCase()}`;
    if (!seenOffice.has(key)) {
      seenOffice.set(key, true);
      continue;
    }
    const name = freeName(o.office_name, await liveOfficeNames(o.employer_id), 255);
    await exec("UPDATE offices SET office_name = ? WHERE id = ?", [name, o.id]);
    report.push(`office ${o.id}: duplicate name "${o.office_name}" renamed to "${name}"`);
  }

  const copyOffice = async (officeId, name) => {
    const id = crypto.randomUUID();
    const cols = OFFICE_COPY_COLUMNS.join(", ");
    await exec(
      `INSERT INTO offices (id, office_name, ${cols}, created_at, updated_at) SELECT ?, ?, ${cols}, ?, ? FROM offices WHERE id = ?`,
      [id, name, now, now, officeId]
    );
    return id;
  };

  // One project per office: the oldest live project keeps it (soft-deleted projects too, so
  // the unique key holds for every row).
  const projects = await select("SELECT id, employer_id, office_id, project_name, deleted_at FROM projects ORDER BY created_at, id");
  const officeTaken = new Set();
  for (const p of projects) {
    if (p.office_id && !officeTaken.has(p.office_id)) {
      officeTaken.add(p.office_id);
      continue;
    }
    if (p.office_id) {
      const [office] = await select("SELECT office_name FROM offices WHERE id = ?", [p.office_id]);
      const name = freeName(office.office_name, await liveOfficeNames(p.employer_id), 255);
      const copy = await copyOffice(p.office_id, name);
      await exec("UPDATE projects SET office_id = ? WHERE id = ?", [copy, p.id]);
      officeTaken.add(copy);
      report.push(`project ${p.id}: moved to a copy of its shared office, "${name}"`);
    } else {
      const taken = await liveOfficeNames(p.employer_id);
      const name = taken.has(p.project_name.toLowerCase()) ? freeName(p.project_name, taken, 255) : p.project_name;
      taken.add(name.toLowerCase());
      const id = crypto.randomUUID();
      await exec(
        "INSERT INTO offices (id, employer_id, office_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [id, p.employer_id, name, now, now]
      );
      await exec("UPDATE projects SET office_id = ? WHERE id = ?", [id, p.id]);
      officeTaken.add(id);
      report.push(`project ${p.id}: had no office; new office "${name}"`);
    }
  }

  // Duplicate live project names (any case): the first keeps its name.
  const projectNames = new Map();
  for (const p of projects.filter((row) => !row.deleted_at)) {
    if (!projectNames.has(p.employer_id)) projectNames.set(p.employer_id, new Set());
    const taken = projectNames.get(p.employer_id);
    if (!taken.has(p.project_name.toLowerCase())) {
      taken.add(p.project_name.toLowerCase());
      continue;
    }
    const name = freeName(p.project_name, taken, 255);
    await exec("UPDATE projects SET project_name = ? WHERE id = ?", [name, p.id]);
    report.push(`project ${p.id}: duplicate name "${p.project_name}" renamed to "${name}"`);
  }

  const [{ n }] = await select("SELECT COUNT(*) AS n FROM projects WHERE status = 'INACTIVE'");
  if (Number(n)) report.push(`${n} INACTIVE project(s) set to ON_HOLD`);
  await exec("UPDATE projects SET status = 'ON_HOLD' WHERE status = 'INACTIVE'");
  return report;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const report = await queryInterface.sequelize.transaction((transaction) => fitData(queryInterface.sequelize, transaction));
    report.forEach((line) => console.log(`[workforce] ${line}`));

    const q = (sql) => queryInterface.sequelize.query(sql);
    // offices: no stored status; live names unique per company. The new key comes first: the old
    // status index also serves the employer_id foreign key.
    await q("ALTER TABLE `offices` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED");
    await queryInterface.addIndex("offices", ["employer_id", "office_name", "live_key"], {
      unique: true,
      name: "uq_offices_employer_id_office_name_live_key",
    });
    await queryInterface.removeIndex("offices", "ix_offices_employer_id_status");
    await queryInterface.removeColumn("offices", "status");

    // projects: exactly one office each, one project per office.
    // ON DELETE SET NULL can't stay on a NOT NULL column; an office with a project isn't deleted anyway.
    await setForeignKey(queryInterface, {
      table: "projects",
      column: "office_id",
      references: "offices",
      nullable: false,
      onDelete: "RESTRICT",
      name: "fk_projects_office_id",
    });
    await queryInterface.addIndex("projects", ["office_id"], { unique: true, name: "uq_projects_office_id" });
    await queryInterface.changeColumn("projects", "status", {
      type: Sequelize.ENUM("ACTIVE", "ON_HOLD", "COMPLETED"),
      allowNull: false,
      defaultValue: "ACTIVE",
    });
    await q("ALTER TABLE `projects` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED");
    await queryInterface.addIndex("projects", ["employer_id", "project_name", "live_key"], {
      unique: true,
      name: "uq_projects_employer_id_project_name_live_key",
    });
  },

  // Schema back; data changes (copied offices, renamed rows, ON_HOLD) are kept.
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("projects", "uq_projects_employer_id_project_name_live_key");
    await queryInterface.removeColumn("projects", "live_key");
    await queryInterface.changeColumn("projects", "status", {
      type: Sequelize.ENUM("ACTIVE", "INACTIVE", "COMPLETED", "ON_HOLD"),
      allowNull: false,
      defaultValue: "ACTIVE",
    });
    // The FK needs an index of its own before the unique one goes.
    await addIndexOnce(queryInterface, "projects", ["office_id"], { name: "ix_projects_office_id" });
    await queryInterface.removeIndex("projects", "uq_projects_office_id");
    await setForeignKey(queryInterface, {
      table: "projects",
      column: "office_id",
      references: "offices",
      nullable: true,
      onDelete: "SET NULL",
      name: "fk_projects_office_id",
    });

    await queryInterface.addColumn("offices", "status", {
      type: Sequelize.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
      after: "lng",
    });
    await queryInterface.addIndex("offices", ["employer_id", "status"], { name: "ix_offices_employer_id_status" });
    await queryInterface.removeIndex("offices", "uq_offices_employer_id_office_name_live_key");
    await queryInterface.removeColumn("offices", "live_key");
  },

  fitData,
};

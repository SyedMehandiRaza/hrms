const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Private contract storage for the seeded PDF, set before anything reads it.
const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contracts-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;

const db = require("../src/models");
const { seedId } = require("../src/utils/seed");
const { build } = require("./helpers/factory");

// Contract Studio schema changes against seeded data, and the contract seeder
// (ticket contract-studio#01, plan section 5).

const qi = db.sequelize.getQueryInterface();
const { Sequelize } = db;
const query = (sql, replacements = []) => db.sequelize.query(sql, { replacements }).then(([rows]) => rows);

const MIGRATIONS_DIR = path.resolve(__dirname, "../src/migrations");
const SEEDERS_DIR = path.resolve(__dirname, "../src/seeders");
const CONTRACT_MIGRATIONS = [
  "20261020000201-contract-studio-hrms-contracts.js",
  "20261020000202-contract-studio-columns.js",
  "20261020000203-contract-studio-template-type.js",
  "20261021000204-contract-recipient-final-statuses.js",
].map((file) => require(path.join(MIGRATIONS_DIR, file)));
const SEEDERS = fs
  .readdirSync(SEEDERS_DIR)
  .filter((file) => /^\d+-.+\.js$/.test(file))
  .sort();
const CONTRACT_SEEDER = "20261019100011-contracts.js";
// Seeders that need the contract schema run separately (the demo one needs ticket 12).
const CONTRACT_DEMO_SEEDER = "20261019100012-contract-demo.js";
const BASE_SEEDERS = SEEDERS.filter((file) => file !== CONTRACT_SEEDER && file !== CONTRACT_DEMO_SEEDER);
const seeder = (file) => require(path.join(SEEDERS_DIR, file));

const migrateUp = async () => {
  for (const m of CONTRACT_MIGRATIONS) await m.up(qi, Sequelize);
};
const migrateDown = async () => {
  for (const m of [...CONTRACT_MIGRATIONS].reverse()) await m.down(qi, Sequelize);
};

const CONTRACT_TABLES = [
  "hrms_contract_types",
  "hrms_contract_documents",
  "hrms_contract_templates",
  "hrms_contract_template_fields",
  "hrms_contracts",
  "hrms_contract_recipients",
  "hrms_contract_fields",
  "hrms_contract_activities",
];

// Columns, indexes and foreign-key rules of the contract tables (constraint names aside).
const schemaOf = async () => {
  const schema = {};
  for (const table of CONTRACT_TABLES) {
    const indexes = await qi.showIndex(table);
    const fks = await query(
      "SELECT k.COLUMN_NAME AS col, k.REFERENCED_TABLE_NAME AS ref, r.DELETE_RULE AS onDelete " +
        "FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r " +
        "ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME " +
        "WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? ORDER BY k.COLUMN_NAME",
      [table]
    );
    schema[table] = {
      columns: await qi.describeTable(table),
      indexes: indexes
        .filter((ix) => !ix.name.includes("ibfk") && !ix.name.startsWith("fk_"))
        .map((ix) => ({ name: ix.name, unique: ix.unique, fields: ix.fields.map((f) => f.attribute) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      foreignKeys: fks,
    };
  }
  return schema;
};

const EMPLOYER = seedId("employer:alnoor");
const DOCUMENT = seedId("contract-document:employment");
const TEMPLATE = seedId("contract-template:employment");
const typeId = (code) => seedId(`contract-type:${code}`);
const rowOf = (table, id) => query(`SELECT * FROM ${table} WHERE id = ?`, [id]).then((rows) => rows[0]);

let latestSchema;
let previousSchema;
let schemaWithSeed;
let roundTripSchema;
const backfill = {};

// Other test files leave rows behind (e.g. modules); the seeders need an empty database.
const emptyAllTables = async () => {
  // Keeps sequelize-cli's own bookkeeping (src/config/database.js table names).
  const KEEP = ["sequelize_meta", "sequelize_data", "sequelizemeta"];
  const tables = (await qi.showAllTables()).filter((t) => !KEEP.includes(t.toLowerCase()));
  // One transaction = one connection, so the session setting applies to every delete.
  await db.sequelize.transaction(async (transaction) => {
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction });
    for (const table of tables) await db.sequelize.query(`DELETE FROM \`${table}\``, { transaction });
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction });
  });
};

beforeAll(async () => {
  await emptyAllTables();
  latestSchema = await schemaOf();
  await migrateDown();
  previousSchema = await schemaOf();

  // The existing seed, written against the schema before Contract Studio.
  for (const file of BASE_SEEDERS) await seeder(file).up(qi, Sequelize);

  // Another company with STAFF but no EMP type, and templates of every kind.
  const other = (await build(db, "Employer")).id;
  await query(
    "INSERT INTO hrms_contract_types (id, employer_id, name, code, created_at, updated_at) VALUES (?, ?, 'Staffing', 'STAFF', NOW(), NOW())",
    [seedId("test:type:other:STAFF"), other]
  );
  const templates = {
    alnoorStaffing: [EMPLOYER, "STAFFING_COMPANY"],
    alnoorVendor: [EMPLOYER, "VENDOR"],
    otherEmployee: [other, "EMPLOYEE"],
    otherStaffing: [other, "STAFFING_COMPANY"],
  };
  for (const [key, [employerId, audience]] of Object.entries(templates)) {
    await query(
      "INSERT INTO hrms_contract_templates (id, employer_id, name, audience_type, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
      [seedId(`test:template:${key}`), employerId, key, audience]
    );
  }

  await migrateUp();
  schemaWithSeed = await schemaOf();
  for (const key of ["alnoorStaffing", "alnoorVendor", "otherEmployee", "otherStaffing"]) {
    backfill[key] = (await rowOf("hrms_contract_templates", seedId(`test:template:${key}`))).contract_type_id;
  }
  backfill.seeded = (await rowOf("hrms_contract_templates", TEMPLATE)).contract_type_id;

  await migrateDown();
  roundTripSchema = await schemaOf();
  await migrateUp();

  await query("DELETE FROM hrms_contract_templates WHERE name IN (?)", [Object.keys(templates)]);
  await query("DELETE FROM hrms_contract_types WHERE employer_id = ?", [other]);
}, 120000);

afterAll(async () => {
  for (const file of [...BASE_SEEDERS].reverse()) await seeder(file).down(qi, Sequelize);
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
}, 120000);

describe("contract migrations", () => {
  it("run on a database with the existing seed", () => {
    expect(schemaWithSeed).toEqual(latestSchema);
  });

  it("restore the previous schema when undone, with or without data", () => {
    expect(roundTripSchema).toEqual(previousSchema);
    expect(previousSchema).not.toEqual(latestSchema);
  });

  it("give each employee template its company's EMP type and each staffing template its STAFF type", () => {
    expect(backfill.seeded).toBe(typeId("EMP"));
    expect(backfill.alnoorStaffing).toBe(typeId("STAFF"));
    expect(backfill.otherStaffing).toBe(seedId("test:type:other:STAFF"));
  });

  it("leave templates without a matching type untyped", () => {
    expect(backfill.otherEmployee).toBeNull();
    expect(backfill.alnoorVendor).toBeNull();
  });
});

describe("contract seeder", () => {
  let before;

  beforeAll(async () => {
    // Freshly migrated and seeded: the seeded template has no type yet.
    await query("UPDATE hrms_contract_templates SET contract_type_id = NULL WHERE id = ?", [TEMPLATE]);
    before = { document: await rowOf("hrms_contract_documents", DOCUMENT), template: await rowOf("hrms_contract_templates", TEMPLATE) };
    await seeder(CONTRACT_SEEDER).up(qi, Sequelize);
  });

  it("adds the Extension (EXT) and Amendment (AMD) types next to EMP and STAFF", async () => {
    const types = await query("SELECT code, name FROM hrms_contract_types WHERE employer_id = ? ORDER BY code", [EMPLOYER]);
    expect(types).toEqual([
      { code: "AMD", name: "Amendment" },
      { code: "EMP", name: "Employment Contract" },
      { code: "EXT", name: "Extension" },
      { code: "STAFF", name: "Staffing Agreement" },
    ]);
  });

  it("stores a real PDF for the seeded document in private storage, with hash, page count and size", async () => {
    const doc = await rowOf("hrms_contract_documents", DOCUMENT);
    expect(doc.file_path).toBe(`${EMPLOYER}/documents/${DOCUMENT}.pdf`);
    const bytes = fs.readFileSync(path.join(STORAGE_DIR, doc.file_path));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(doc.file_sha256).toBe(crypto.createHash("sha256").update(bytes).digest("hex"));
    expect(Number(doc.file_size_bytes)).toBe(bytes.length);
    expect(doc.page_count).toBe(3);
    expect(bytes.toString("latin1").match(/\/Type \/Page\b(?!s)/g)).toHaveLength(3);
    expect(doc.status).toBe("SAVED");
  });

  it("makes the seeded employee template ACTIVE, type EMP, with a required signature, a date and two merge fields", async () => {
    const template = await rowOf("hrms_contract_templates", TEMPLATE);
    expect(template).toMatchObject({ status: "ACTIVE", audience_type: "EMPLOYEE", contract_type_id: typeId("EMP") });
    const fields = await query("SELECT field_type, db_source, db_column, is_required FROM hrms_contract_template_fields WHERE template_id = ?", [TEMPLATE]);
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field_type: "SIGNATURE", is_required: 1 }),
        expect.objectContaining({ field_type: "DATE" }),
        expect.objectContaining({ field_type: "DB_COLUMN", db_source: "EMPLOYEE", db_column: "employee_name" }),
        expect.objectContaining({ field_type: "DB_COLUMN", db_source: "EMPLOYEE", db_column: "designation" }),
      ])
    );
  });

  it("adds an ACTIVE staffing template of type STAFF with a required signature", async () => {
    const [template] = await query(
      "SELECT * FROM hrms_contract_templates WHERE employer_id = ? AND audience_type = 'STAFFING_COMPANY' AND deleted_at IS NULL",
      [EMPLOYER]
    );
    expect(template).toMatchObject({ status: "ACTIVE", contract_type_id: typeId("STAFF"), document_id: DOCUMENT });
    const signatures = await query(
      "SELECT id FROM hrms_contract_template_fields WHERE template_id = ? AND field_type = 'SIGNATURE' AND is_required = 1",
      [template.id]
    );
    expect(signatures.length).toBeGreaterThanOrEqual(1);
  });

  it("places each seeded field on its line of the sample document", async () => {
    const { render } = require("../src/services/contractPdf.service");
    const { openPdf, pageText } = require("./helpers/pdf");
    const source = fs.readFileSync(path.join(__dirname, "../seed-assets/contracts/sample-contract.pdf"));
    // seeded field → the start of the document line it fills in
    const LINE = { employee_name: "Employee name:", company_name: "Employee name:", designation: "Designation:", SIGNATURE: "Signature:", DATE: "Date:" };
    const fields = await query(
      "SELECT f.* FROM hrms_contract_template_fields f JOIN hrms_contract_templates t ON t.id = f.template_id WHERE t.employer_id = ? AND t.deleted_at IS NULL",
      [EMPLOYER]
    );
    expect(fields.length).toBeGreaterThanOrEqual(6);
    for (const f of fields) {
      const marker = `V${f.id.slice(0, 6)}`;
      const value = f.field_type === "SIGNATURE" ? { type: "TYPED", text: marker } : marker;
      const { bytes } = await render({ sourceBytes: source, fields: [{ ...f, value }] });
      const items = await pageText(await openPdf(bytes), f.page_no);
      const line = items.find((i) => i.str.startsWith(LINE[f.db_column || f.field_type]));
      const stamped = items.find((i) => i.str === marker);
      expect({ field: f.db_column || f.field_type, dy: Math.abs(stamped.y - line.y) <= 3 }).toEqual({ field: f.db_column || f.field_type, dy: true });
    }
  });

  it("leaves the shared activity seeder file unchanged", () => {
    const text = fs.readFileSync(path.join(SEEDERS_DIR, "20261019100010-activity.js"), "utf8").replace(/\r\n/g, "\n");
    expect(crypto.createHash("sha256").update(text).digest("hex")).toBe("dbee981ecd940dc290e4d5673c701ad5889982a9c900f91122252a8f7169b680");
  });

  it("restores the seeded document and template when undone", async () => {
    const doc = await rowOf("hrms_contract_documents", DOCUMENT);
    await seeder(CONTRACT_SEEDER).down(qi, Sequelize);
    expect(await rowOf("hrms_contract_documents", DOCUMENT)).toEqual(before.document);
    expect(await rowOf("hrms_contract_templates", TEMPLATE)).toEqual(before.template);
    expect(await query("SELECT id FROM hrms_contract_template_fields WHERE employer_id = ?", [EMPLOYER])).toEqual([]);
    expect(await query("SELECT code FROM hrms_contract_types WHERE employer_id = ? AND code IN ('EXT','AMD')", [EMPLOYER])).toEqual([]);
    expect(await query("SELECT id FROM hrms_contract_templates WHERE employer_id = ? AND audience_type = 'STAFFING_COMPANY'", [EMPLOYER])).toEqual([]);
    expect(fs.existsSync(path.join(STORAGE_DIR, doc.file_path))).toBe(false);
  });
});

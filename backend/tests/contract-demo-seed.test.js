const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contract-demo-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;

const db = require("../src/models");
const { seedId } = require("../src/utils/seed");
const { todayIn, addDays } = require("../src/utils/companyTime");
const { valuesSha256 } = require("../src/services/contractMerge.service");
const { openPdf, pageText } = require("./helpers/pdf");

// Demo contracts seed (ticket contract-studio#25; plan section 5).

const qi = db.sequelize.getQueryInterface();
const { Sequelize } = db;
const SEEDERS_DIR = path.resolve(__dirname, "../src/seeders");
const SEEDERS = fs
  .readdirSync(SEEDERS_DIR)
  .filter((file) => /^\d+-.+\.js$/.test(file))
  .sort();
const DEMO = "20261019100012-contract-demo.js";
const seeder = (file) => require(path.join(SEEDERS_DIR, file));

const EMPLOYER = seedId("employer:alnoor");
const SARA = seedId("employee:sara");
const GMS = seedId("staffing:gulf-manpower");

const emptyAllTables = async () => {
  const KEEP = ["sequelize_meta", "sequelize_data", "sequelizemeta"];
  const tables = (await qi.showAllTables()).filter((t) => !KEEP.includes(t.toLowerCase()));
  await db.sequelize.transaction(async (transaction) => {
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction });
    for (const table of tables) await db.sequelize.query(`DELETE FROM \`${table}\``, { transaction });
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction });
  });
};

const demoContracts = () =>
  db.Contract.findAll({
    where: { employer_id: EMPLOYER },
    include: [{ model: db.ContractRecipient, as: "contractRecipients" }],
    order: [["created_at", "ASC"]],
  });

beforeAll(async () => {
  await emptyAllTables();
  for (const file of SEEDERS) await seeder(file).up(qi, Sequelize);
}, 180000);

afterAll(async () => {
  await emptyAllTables();
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
}, 120000);

describe("demo contracts seed", () => {
  it("gives employee@hrms.test a SENT, a SUBMITTED and a COMPLETED contract, and the staffing company a SENT one, all numbered", async () => {
    const all = await demoContracts();
    const forSara = all.filter((c) => c.contractRecipients[0].employee_id === SARA).map((c) => c.status).sort();
    expect(forSara).toEqual(["COMPLETED", "SENT", "SUBMITTED"]);
    const forGms = all.filter((c) => c.contractRecipients[0].staffing_company_id === GMS).map((c) => c.status);
    expect(forGms).toEqual(["SENT"]);
    all.forEach((c) => expect(c.reference_no).toMatch(/^CON-\d{4}-\d{4}$/));
  });

  it("sets the SENT contracts' sign-by to 7 days after the seed day, so they aren't expired", async () => {
    const today = todayIn("Asia/Riyadh");
    for (const c of (await demoContracts()).filter((x) => x.status === "SENT")) {
      expect(c.meta.sign_by).toBe(addDays(today, 7));
      expect(c.expires_at.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("stores a final PDF for the COMPLETED contract that ends with the certificate page and matches its hash", async () => {
    const c = (await demoContracts()).find((x) => x.status === "COMPLETED");
    const bytes = fs.readFileSync(path.join(STORAGE_DIR, c.signed_pdf_path));
    expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(c.signed_pdf_sha256);
    const doc = await openPdf(bytes);
    const last = (await pageText(doc, doc.numPages)).map((i) => i.str);
    expect(last).toContain("Certificate of completion");
  });

  it("has evidence on the SUBMITTED contract whose values hash reproduces", async () => {
    const c = (await demoContracts()).find((x) => x.status === "SUBMITTED");
    const r = c.contractRecipients[0];
    expect(r.evidence).toMatchObject({ employee_id: SARA, profile_name: "Sara Khan", consent_version: "v1" });
    const fields = await db.ContractField.findAll({ where: { contract_id: c.id } });
    const entries = fields.map((x) => {
      const parsed = (x.field_type === "SIGNATURE" || x.field_type === "INITIALS") && x.value ? JSON.parse(x.value) : null;
      return { id: x.id, field_type: x.field_type, value: parsed && parsed.type === "DRAWN" ? parsed.sha256 : x.value };
    });
    expect(valuesSha256(entries)).toBe(r.evidence.values_sha256);
  });

  it("removes the demo contracts, their files and activity when undone", async () => {
    const before = await demoContracts();
    const files = before.filter((c) => c.signed_pdf_path).map((c) => c.signed_pdf_path);
    await seeder(DEMO).down(qi, Sequelize);
    expect(await demoContracts()).toEqual([]);
    expect(await db.ContractActivity.count({ where: { contract_id: before.map((c) => c.id) } })).toBe(0);
    expect(await db.Notification.count({ where: { entity_id: before.map((c) => c.id) } })).toBe(0);
    files.forEach((p) => expect(fs.existsSync(path.join(STORAGE_DIR, p))).toBe(false));
    const sigDir = path.join(STORAGE_DIR, EMPLOYER, "signatures");
    expect(fs.existsSync(sigDir) ? fs.readdirSync(sigDir) : []).toEqual([]);
  });
});

const h = require("./contracts");
const { todayIn, addDays } = require("../../src/utils/companyTime");

const { db } = h;

// Contract Studio fixtures: a company with a document, a type and ACTIVE templates.
// Documents are rows only unless a test needs the real file (it then uploads one).

const TZ = "Asia/Riyadh";
const today = () => todayIn(TZ);
const inDays = (n) => addDays(today(), n);

const sig = (overrides = {}) => ({ field_type: "SIGNATURE", page_no: 3, pos_x: 0.25, pos_y: 0.17, width: 0.35, height: 0.06, label: "Signature", is_required: true, ...overrides });
const mergeField = (db_source, db_column, overrides = {}) => ({ field_type: "DB_COLUMN", page_no: 1, pos_x: 0.3, pos_y: 0.135, width: 0.4, height: 0.03, db_source, db_column, is_required: true, ...overrides });

// Inserts a template with its fields directly (no API round trip).
const makeTemplate = async (employer, { audience = "EMPLOYEE", document, type, fields = [sig()], status = "ACTIVE", name = "Employment Agreement" } = {}) => {
  const t = await db.ContractTemplate.create({
    employer_id: employer.id,
    document_id: document.id,
    contract_type_id: type ? type.id : null,
    name,
    audience_type: audience,
    page_count: document.page_count,
    status,
  });
  await db.ContractTemplateField.bulkCreate(
    fields.map((f, i) => ({ template_id: t.id, employer_id: employer.id, label: f.label || f.db_column || f.field_type, sort_order: i, assigned_role: "PRIMARY_SIGNER", ...f }))
  );
  return t;
};

const setupCompany = async (name) => {
  const company = await h.createCompany(name);
  const { employer } = company;
  const document = await db.ContractDocument.create({ employer_id: employer.id, name: "Doc", page_count: 3, status: "SAVED" });
  const type = await db.ContractType.create({ employer_id: employer.id, name: "Employment Contract", code: "EMP" });
  const staffType = await db.ContractType.create({ employer_id: employer.id, name: "Staffing Agreement", code: "STAFF" });
  const template = await makeTemplate(employer, { document, type, fields: [mergeField("EMPLOYEE", "employee_name"), sig()] });
  const staffingTemplate = await makeTemplate(employer, { audience: "STAFFING_COMPANY", document, type: staffType, name: "Staffing Agreement", fields: [mergeField("STAFFING_COMPANY", "company_name"), sig()] });
  await db.CompanyTimeSetting.findOrCreate({ where: { employer_id: employer.id }, defaults: { timezone: TZ } });
  const year = Number(today().slice(0, 4));
  const fy = await db.FinancialYear.create({
    employer_id: employer.id,
    year_key: year,
    label: `FY ${year}`,
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    status: "OPEN",
  });
  return { ...company, document, type, staffType, template, staffingTemplate, fy, year, token: await h.ownerToken(company) };
};

// Gives a document the real sample PDF in private storage (CONTRACT_STORAGE_DIR must be set).
const SAMPLE_PDF = require("fs").readFileSync(require("path").resolve(__dirname, "../../seed-assets/contracts/sample-contract.pdf"));
const attachSampleFile = async (document) => {
  const { saveNew } = require("../../src/services/contractFiles.service");
  const stored = await saveNew(document.employer_id, "documents", "pdf", SAMPLE_PDF);
  await document.update({ file_path: stored.path, file_sha256: stored.sha256, file_size_bytes: SAMPLE_PDF.length });
  return document;
};

const terms = (overrides = {}) => ({ start_date: today(), sign_by: inDays(7), ...overrides });

const createContracts = (token, body, opts) => h.api.post("/contracts", token, body, opts);
// token null → no Authorization header.
const draftsFor = (ctx, recipientIds, overrides = {}, token) =>
  createContracts(token === undefined ? ctx.token : token, { mode: "DRAFT", templateId: ctx.template.id, recipientIds, ...terms(), ...overrides });

module.exports = { TZ, today, inDays, sig, mergeField, makeTemplate, setupCompany, terms, createContracts, draftsFor, attachSampleFile, SAMPLE_PDF };

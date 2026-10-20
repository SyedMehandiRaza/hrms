"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { seedId, deleteIds } = require("../utils/seed");
const storage = require("../services/storage.service");

// Contract Studio seed (plan section 5). The shared activity seeder is never edited: this
// seeder adds the EXT and AMD types and UPDATES the document and template it inserted;
// down() reverts only what it changed.

const EMPLOYER = seedId("employer:alnoor");
const ADMIN = seedId("user:admin");
const DOCUMENT = seedId("contract-document:employment");
const EMPLOYMENT_TEMPLATE = seedId("contract-template:employment");
const STAFFING_TEMPLATE = seedId("contract-template:staffing");
const typeId = (code) => seedId(`contract-type:${code}`);

const SAMPLE_PDF = path.resolve(__dirname, "../../seed-assets/contracts/sample-contract.pdf");
const PAGE_COUNT = 3;
const DOCUMENT_PATH = `${EMPLOYER}/documents/${DOCUMENT}.pdf`;

const TYPES = [
  { code: "EXT", name: "Extension", description: "Extends an existing contract" },
  { code: "AMD", name: "Amendment", description: "Changes the terms of an existing contract" },
];

// Positions are page-relative decimals (plan decision 9).
const field = (templateId, key, values) => ({
  id: seedId(`contract-template-field:${templateId}:${key}`),
  template_id: templateId,
  employer_id: EMPLOYER,
  is_required: true,
  assigned_role: "PRIMARY_SIGNER",
  ...values,
});

const templateFields = () => [
  field(EMPLOYMENT_TEMPLATE, "employee_name", {
    page_no: 1, field_type: "DB_COLUMN", label: "Employee Name", db_source: "EMPLOYEE", db_column: "employee_name",
    pos_x: 0.3, pos_y: 0.135, width: 0.4, height: 0.03, sort_order: 1,
  }),
  field(EMPLOYMENT_TEMPLATE, "designation", {
    page_no: 1, field_type: "DB_COLUMN", label: "Designation", db_source: "EMPLOYEE", db_column: "designation",
    pos_x: 0.3, pos_y: 0.168, width: 0.4, height: 0.03, sort_order: 2,
  }),
  field(EMPLOYMENT_TEMPLATE, "signature", {
    page_no: 3, field_type: "SIGNATURE", label: "Signature", pos_x: 0.25, pos_y: 0.17, width: 0.35, height: 0.06, sort_order: 3,
  }),
  field(EMPLOYMENT_TEMPLATE, "date", {
    page_no: 3, field_type: "DATE", label: "Date", pos_x: 0.2, pos_y: 0.245, width: 0.25, height: 0.03, sort_order: 4,
  }),
  field(STAFFING_TEMPLATE, "company_name", {
    page_no: 1, field_type: "DB_COLUMN", label: "Company Name", db_source: "STAFFING_COMPANY", db_column: "company_name",
    pos_x: 0.3, pos_y: 0.135, width: 0.4, height: 0.03, sort_order: 1,
  }),
  field(STAFFING_TEMPLATE, "signature", {
    page_no: 3, field_type: "SIGNATURE", label: "Signature", pos_x: 0.25, pos_y: 0.17, width: 0.35, height: 0.06, sort_order: 2,
  }),
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "hrms_contract_types",
      TYPES.map((t) => ({ id: typeId(t.code), employer_id: EMPLOYER, ...t, created_by: ADMIN, created_at: now, updated_at: now }))
    );

    const bytes = fs.readFileSync(SAMPLE_PDF);
    await storage.removePrivate(DOCUMENT_PATH);
    await storage.savePrivate(bytes, DOCUMENT_PATH);
    await queryInterface.bulkUpdate(
      "hrms_contract_documents",
      {
        file_path: DOCUMENT_PATH,
        file_sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        file_size_bytes: bytes.length,
        page_count: PAGE_COUNT,
        status: "SAVED",
      },
      { id: DOCUMENT }
    );

    await queryInterface.bulkUpdate("hrms_contract_templates", { contract_type_id: typeId("EMP"), status: "ACTIVE" }, { id: EMPLOYMENT_TEMPLATE });
    await queryInterface.bulkInsert("hrms_contract_templates", [
      {
        id: STAFFING_TEMPLATE,
        employer_id: EMPLOYER,
        document_id: DOCUMENT,
        contract_type_id: typeId("STAFF"),
        name: "Staffing Agreement",
        description: "Manpower supply agreement with a staffing company.",
        audience_type: "STAFFING_COMPANY",
        page_count: PAGE_COUNT,
        status: "ACTIVE",
        created_by: ADMIN,
        created_at: now,
        updated_at: now,
      },
    ]);
    await queryInterface.bulkInsert(
      "hrms_contract_template_fields",
      templateFields().map((f) => ({ ...f, created_at: now, updated_at: now }))
    );
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["hrms_contract_template_fields", templateFields().map((f) => f.id)],
      ["hrms_contract_templates", [STAFFING_TEMPLATE]],
    ]);
    await queryInterface.bulkUpdate("hrms_contract_templates", { contract_type_id: null }, { id: EMPLOYMENT_TEMPLATE });
    await queryInterface.bulkUpdate(
      "hrms_contract_documents",
      { file_path: null, file_sha256: null, file_size_bytes: null },
      { id: DOCUMENT }
    );
    await storage.removePrivate(DOCUMENT_PATH);
    await deleteIds(queryInterface, [["hrms_contract_types", TYPES.map((t) => typeId(t.code))]]);
  },
};

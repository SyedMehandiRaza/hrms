"use strict";

const { seedId } = require("../utils/seed");

// Demo contracts (plan section 5, ticket contract-studio#25), created through the real
// services so numbers, evidence, hashes and the final PDF are genuine. Dates are relative
// to the day the seed runs (sign-by = today + 7). Each contract is marked meta.demo so
// down() removes only these, with their files and activity.
//   employee@hrms.test (Sara): COMPLETED and SUBMITTED (Employment), SENT (Extension)
//   Gulf Manpower:             SENT (Staffing Agreement)

const EMPLOYER = seedId("employer:alnoor");
const ADMIN = { employerId: EMPLOYER, userId: seedId("user:admin"), accountId: seedId("account:admin"), accessLevel: "ADMIN" };
const SARA_LOGIN = { employerId: EMPLOYER, userId: seedId("user:employee"), accountId: seedId("account:employee"), accessLevel: "GENERAL_EMPLOYEE" };
const SARA = seedId("employee:sara");
const GMS = seedId("staffing:gulf-manpower");
const EMPLOYMENT_TEMPLATE = seedId("contract-template:employment");
const STAFFING_TEMPLATE = seedId("contract-template:staffing");
const EXTENSION_TEMPLATE = seedId("contract-template:extension");
const SEED_REQUEST = { ip: "127.0.0.1", userAgent: "hrms demo seed" };

const services = () => ({
  db: require("../models"),
  contracts: require("../services/contract.service"),
  sending: require("../services/contractSend.service"),
  signing: require("../services/contractSign.service"),
  approval: require("../services/contractApproval.service"),
  storage: require("../services/storage.service"),
  time: require("../utils/companyTime"),
});

const demoIds = async (db) =>
  (await db.sequelize.query("SELECT id FROM hrms_contracts WHERE employer_id = ? AND JSON_EXTRACT(meta, '$.demo') = true", { replacements: [EMPLOYER] }))[0].map(
    (r) => r.id
  );

module.exports = {
  async up() {
    const { db, contracts, sending, signing, approval, time } = services();
    const today = time.todayIn(await time.companyTimezone(EMPLOYER));

    // An Extension template: the employment template's document and fields, type EXT.
    const base = await db.ContractTemplate.findByPk(EMPLOYMENT_TEMPLATE, { include: ["contractTemplateFields"] });
    await db.ContractTemplate.create({
      id: EXTENSION_TEMPLATE,
      employer_id: EMPLOYER,
      document_id: base.document_id,
      contract_type_id: seedId("contract-type:EXT"),
      name: "Contract Extension",
      audience_type: "EMPLOYEE",
      page_count: base.page_count,
      status: "ACTIVE",
      created_by: ADMIN.userId,
    });
    await db.ContractTemplateField.bulkCreate(
      base.contractTemplateFields.map((f) => {
        const copy = { ...f.get({ plain: true }), template_id: EXTENSION_TEMPLATE };
        ["id", "createdAt", "updatedAt"].forEach((key) => delete copy[key]);
        return copy;
      })
    );

    const send = async (templateId, recipientId, name) => {
      const { results } = await contracts.createContracts(
        ADMIN,
        { mode: "SEND", templateId, recipientIds: [recipientId], name, start_date: today },
        { sendOne: sending.sendRow("en"), beforeSend: sending.assertOpenYear, lang: "en" }
      );
      const row = results[0];
      if (row.result !== "SENT") throw new Error(`demo seed: "${name}" was not sent (${row.code}: ${row.message})`);
      const c = await db.Contract.findByPk(row.contractId);
      await c.update({ meta: { ...c.meta, demo: true } });
      return row.contractId;
    };
    const sign = async (id) => {
      const fields = await db.ContractField.findAll({ where: { contract_id: id } });
      const values = {};
      fields.forEach((f) => {
        if (f.field_type === "SIGNATURE") values[f.id] = { type: "TYPED", text: "Sara Khan" };
        if (f.field_type === "DATE") values[f.id] = today;
      });
      await signing.submitContract(SARA_LOGIN, id, { consent: true, fields: values }, SEED_REQUEST);
    };

    const completed = await send(EMPLOYMENT_TEMPLATE, SARA, "Employment Agreement (completed)");
    await sign(completed);
    await approval.approveContract(ADMIN, completed);
    const submitted = await send(EMPLOYMENT_TEMPLATE, SARA, "Employment Agreement (awaiting approval)");
    await sign(submitted);
    await send(EXTENSION_TEMPLATE, SARA, "Contract Extension (to sign)");
    await send(STAFFING_TEMPLATE, GMS, "Staffing Agreement (to sign)");
  },

  async down() {
    const { db, storage } = services();
    const ids = await demoIds(db);
    if (ids.length) {
      const files = [];
      for (const c of await db.Contract.findAll({ where: { id: ids }, paranoid: false })) if (c.signed_pdf_path) files.push(c.signed_pdf_path);
      for (const f of await db.ContractField.findAll({ where: { contract_id: ids } })) {
        if ((f.field_type === "SIGNATURE" || f.field_type === "INITIALS") && f.value) {
          try {
            const v = JSON.parse(f.value);
            if (v.type === "DRAWN") files.push(v.path);
          } catch {
            // not a signature value
          }
        }
      }
      await db.Notification.destroy({ where: { entity_type: "contract", entity_id: ids } });
      await db.ContractActivity.destroy({ where: { contract_id: ids } });
      await db.ContractField.destroy({ where: { contract_id: ids } });
      await db.ContractRecipient.destroy({ where: { contract_id: ids } });
      await db.Contract.destroy({ where: { id: ids }, force: true });
      await Promise.all(files.map((p) => storage.removePrivate(p)));
    }
    await db.ContractTemplateField.destroy({ where: { template_id: EXTENSION_TEMPLATE } });
    await db.ContractTemplate.destroy({ where: { id: EXTENSION_TEMPLATE }, force: true });
  },
};

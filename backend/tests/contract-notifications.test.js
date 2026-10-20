const fs = require("fs");
const os = require("os");
const path = require("path");

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contract-notify-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;
process.env.APP_URL = "https://hrms.example.test";

const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");
const mailer = require("../src/services/mailer");
const { runContractJob } = require("../src/jobs/contractJob");
const { formatDate } = require("../src/utils/companyTime");

const { db, api, createEmployee, createStaffingCompany, loginAs, hrLogin } = h;
const { setupCompany, createContracts, terms, attachSampleFile, inDays } = f;

// Contract notifications (ticket contract-studio#14; plan decision 43).

afterAll(async () => {
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

const REASON = "The salary differs from what was agreed.";
const flush = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
};
const rowsFor = (userId, contractId) => db.Notification.findAll({ where: { user_id: userId, entity_id: contractId }, order: [["created_at", "ASC"]] });
const mailsTo = (email) => mailer.outbox().filter((m) => m.to === email);

let ctx;
let hr; // the HR sub-admin who creates the contracts
beforeAll(async () => {
  ctx = await setupCompany();
  await attachSampleFile(ctx.document);
  hr = await hrLogin(ctx.employer, h.ALL_FLAGS);
});
beforeEach(() => mailer.clear());

const sendTo = async (employee, overrides = {}) => {
  const type = await db.ContractType.create({ employer_id: ctx.employer.id, name: `T ${h.short()}`, code: `T${h.short()}` });
  await ctx.template.update({ contract_type_id: type.id });
  const res = await createContracts(hr.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: [employee.id], name: "Employment Agreement", ...terms(), ...overrides });
  await flush();
  return res.body.data.results[0].contractId;
};
const newSigner = async (lang = "EN") => {
  const { user, employee } = await createEmployee(ctx.employer, { full_name: "Sara Khan" });
  await user.update({ lang_key: lang });
  return { user, employee, token: await loginAs(user.email) };
};
const submit = async (s, id) => {
  const sigId = (await db.ContractField.findAll({ where: { contract_id: id } })).find((x) => x.field_type === "SIGNATURE").id;
  const res = await h.withAuth(h.request(h.app).post(`/api/my/contracts/${id}/submit`), s.token).send({ consent: true, fields: { [sigId]: { type: "TYPED", text: "Sara Khan" } } });
  expect(res.status).toBe(200);
  await flush();
};

it("notifies the signer when HR sends: row + email with the exact text and the employee link", async () => {
  const s = await newSigner();
  const id = await sendTo(s.employee, { sign_by: inDays(7) });
  const c = await db.Contract.findByPk(id);
  const [row] = await rowsFor(s.user.id, id);
  const body = `Employment Agreement (${c.reference_no}) is waiting for your signature. Sign by ${formatDate(inDays(7))}.`;
  expect(row).toMatchObject({ type: "CONTRACT_SENT", title: "New contract to sign", body, entity_type: "contract", entity_id: id, employer_id: ctx.employer.id });
  const [mail] = mailsTo(s.user.email);
  expect(mail).toMatchObject({ subject: "New contract to sign", lang: "en", template: "contract-notification" });
  expect(mail.text).toBe(`${body}\n\nOpen contract: https://hrms.example.test/employee/my-contracts?contract=${id}`);
});

it("writes the row and email in the receiver's language (Arabic)", async () => {
  const s = await newSigner("AR");
  const id = await sendTo(s.employee);
  const [row] = await rowsFor(s.user.id, id);
  expect(row.title).toBe("عقد جديد للتوقيع");
  const [mail] = mailsTo(s.user.email);
  expect(mail.lang).toBe("ar");
  expect(mail.text).toContain("فتح العقد: https://hrms.example.test/employee/my-contracts?contract=");
});

it("links a staffing company to its portal and the owner signer to My Requests", async () => {
  const { user, company } = await createStaffingCompany(ctx.employer, { name: "Gulf Manpower" });
  const res = await createContracts(hr.token, { mode: "SEND", templateId: ctx.staffingTemplate.id, recipientIds: [company.id], ...terms() });
  await flush();
  const sid = res.body.data.results[0].contractId;
  expect(mailsTo(user.email)[0].text).toContain(`https://hrms.example.test/staffing-company/contracts?contract=${sid}`);

  const ownerEmp = await db.Employee.create({ user_id: ctx.owner.id, employer_id: ctx.employer.id, employee_code: `E-${h.short()}`, country_emp_id: `O${h.short()}`, full_name: "Owner Person" });
  const oid = await sendTo(ownerEmp);
  expect(mailsTo(ctx.owner.email)[0].text).toContain(`https://hrms.example.test/admin/my-requests/contracts?contract=${oid}`);
});

it("notifies the creator when the signer submits, linking to the HR list", async () => {
  const s = await newSigner();
  const id = await sendTo(s.employee);
  mailer.clear();
  await submit(s, id);
  const c = await db.Contract.findByPk(id);
  const [row] = (await rowsFor(hr.user.id, id)).filter((r) => r.type === "CONTRACT_SIGNED");
  expect(row).toMatchObject({ title: "Contract signed", body: `Sara Khan signed Employment Agreement (${c.reference_no}). It's ready for your approval.` });
  expect(mailsTo(hr.user.email)[0].text).toContain(`https://hrms.example.test/admin/new-contracts?contract=${id}`);
});

it("notifies the creator with the reason when the signer rejects", async () => {
  const s = await newSigner();
  const id = await sendTo(s.employee);
  await h.withAuth(h.request(h.app).post(`/api/my/contracts/${id}/reject`), s.token).send({ reason: REASON });
  await flush();
  const c = await db.Contract.findByPk(id);
  const [row] = (await rowsFor(hr.user.id, id)).filter((r) => r.type === "CONTRACT_REJECTED");
  expect(row.body).toBe(`Sara Khan rejected Employment Agreement (${c.reference_no}): ${REASON}`);
});

it("notifies the signer once when the job records the 2-day reminder", async () => {
  const s = await newSigner();
  const id = await sendTo(s.employee, { sign_by: inDays(7) });
  const c = await db.Contract.findByPk(id);
  const now = new Date(c.expires_at.getTime() - 24 * 3600 * 1000);
  await runContractJob({ now });
  await runContractJob({ now });
  await flush();
  const rows = (await rowsFor(s.user.id, id)).filter((r) => r.type === "CONTRACT_EXPIRING");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ title: "Contract expires soon", body: `Employment Agreement (${c.reference_no}) must be signed by ${formatDate(inDays(7))}.` });
});

it("notifies the creator and the signer when a contract expires", async () => {
  const s = await newSigner();
  const id = await sendTo(s.employee);
  await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id } });
  await runContractJob();
  await flush();
  const c = await db.Contract.findByPk(id);
  const expected = `Employment Agreement (${c.reference_no}) wasn't signed by ${formatDate(c.meta.sign_by)} and has expired.`;
  for (const userId of [s.user.id, hr.user.id]) {
    const rows = (await rowsFor(userId, id)).filter((r) => r.type === "CONTRACT_EXPIRED");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Contract expired", body: expected });
  }
});

it("notifies the signer with the reason on an HR revoke, and only the creator on an auto-revoke", async () => {
  const a = await newSigner();
  const ida = await sendTo(a.employee);
  await api.post(`/contracts/${ida}/revoke`, hr.token, { reason: "Terms changed after negotiation." });
  await flush();
  const ca = await db.Contract.findByPk(ida);
  expect((await rowsFor(a.user.id, ida)).find((r) => r.type === "CONTRACT_REVOKED").body).toBe(
    `Employment Agreement (${ca.reference_no}) was withdrawn by HR: Terms changed after negotiation.`
  );
  expect((await rowsFor(hr.user.id, ida)).filter((r) => r.type.startsWith("CONTRACT_REVOKED"))).toHaveLength(0);

  const b = await newSigner();
  const idb = await sendTo(b.employee);
  await b.employee.update({ employment_status: "EXITED" });
  await runContractJob();
  await flush();
  const cb = await db.Contract.findByPk(idb);
  expect((await rowsFor(hr.user.id, idb)).find((r) => r.type === "CONTRACT_REVOKED_AUTO").body).toBe(
    `Employment Agreement (${cb.reference_no}) was withdrawn because Sara Khan is no longer active.`
  );
  expect((await rowsFor(b.user.id, idb)).filter((r) => r.type.startsWith("CONTRACT_REVOKED"))).toHaveLength(0);
});

it("notifies the signer when HR approves", async () => {
  const s = await newSigner();
  const id = await sendTo(s.employee);
  await submit(s, id);
  await api.post(`/contracts/${id}/approve`, hr.token, {});
  await flush();
  const c = await db.Contract.findByPk(id);
  expect((await rowsFor(s.user.id, id)).find((r) => r.type === "CONTRACT_COMPLETED")).toMatchObject({
    title: "Contract completed",
    body: `Employment Agreement (${c.reference_no}) has been approved. You can download the final PDF.`,
  });
});

it("emails never carry a PDF or merge/field values", async () => {
  const s = await newSigner();
  await sendTo(s.employee);
  for (const mail of mailsTo(s.user.email)) {
    expect(mail).not.toHaveProperty("attachments");
    expect(mail.text).not.toContain("Sara Khan"); // the employee_name merge value
  }
});

it("sends nothing to a creator with no current account, and the action still succeeds", async () => {
  const creator = await hrLogin(ctx.employer, h.ALL_FLAGS);
  const s = await newSigner();
  const type = await db.ContractType.create({ employer_id: ctx.employer.id, name: `T ${h.short()}`, code: `T${h.short()}` });
  await ctx.template.update({ contract_type_id: type.id });
  const id = (await createContracts(creator.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: [s.employee.id], ...terms() })).body.data.results[0].contractId;
  await db.HrmsAccount.update({ status: "INACTIVE" }, { where: { user_id: creator.user.id } });
  mailer.clear();
  await submit(s, id);
  expect(await rowsFor(creator.user.id, id)).toHaveLength(0);
  expect(mailsTo(creator.user.email)).toHaveLength(0);
  expect((await db.Contract.findByPk(id)).status).toBe("SUBMITTED");
  expect(await db.ContractActivity.count({ where: { contract_id: id, action: "SIGNED" } })).toBe(1);
});

it("keeps the action done and logs when the email fails", async () => {
  const spy = jest.spyOn(mailer, "send").mockRejectedValue(new Error("smtp down"));
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const s = await newSigner();
  const id = await sendTo(s.employee);
  await flush();
  expect((await db.Contract.findByPk(id)).status).toBe("SENT");
  expect(await rowsFor(s.user.id, id)).toHaveLength(1);
  expect(log.mock.calls.flat().join(" ")).toMatch(/notification email failed/);
  spy.mockRestore();
  log.mockRestore();
});

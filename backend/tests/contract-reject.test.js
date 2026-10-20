const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");

const { db, errorBody, validationBody, createEmployee, createStaffingCompany, loginAs } = h;
const { setupCompany, createContracts, terms } = f;

// Reject (ticket contract-studio#24; plan decisions 30, 37).

afterAll(() => db.sequelize.close());

const REASON = "The salary differs from what was agreed.";
const post = (token, id, action, body, lang) => h.withAuth(h.request(h.app).post(`/api/my/contracts/${id}/${action}`), token, lang).send(body);
const reject = (token, id, body, lang) => post(token, id, "reject", body, lang);

let ctx;
beforeAll(async () => {
  ctx = await setupCompany();
});

// A fresh signer with one SENT contract of its own type.
const fresh = async ({ staffing = false } = {}) => {
  if (staffing) {
    const { user, company } = await createStaffingCompany(ctx.employer);
    const res = await createContracts(ctx.token, { mode: "SEND", templateId: ctx.staffingTemplate.id, recipientIds: [company.id], ...terms() });
    return { user, company, token: await loginAs(user.email), id: res.body.data.results[0].contractId };
  }
  const { user, employee } = await createEmployee(ctx.employer, { full_name: `Emp ${h.short()}` });
  const res = await createContracts(ctx.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: [employee.id], ...terms() });
  return { user, employee, token: await loginAs(user.email), id: res.body.data.results[0].contractId };
};

it("rejects with a 10–500 character reason: REJECTED, recipient DECLINED with the reason, DECLINED activity", async () => {
  const s = await fresh();
  const res = await reject(s.token, s.id, { reason: `  ${REASON}  ` });
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ id: s.id, status: "REJECTED" });
  const c = await db.Contract.findByPk(s.id, { include: ["contractRecipients"] });
  expect(c.status).toBe("REJECTED");
  expect(c.contractRecipients[0]).toMatchObject({ status: "DECLINED", reject_reason: REASON });
  const acts = await db.ContractActivity.findAll({ where: { contract_id: s.id, action: "DECLINED" } });
  expect(acts).toHaveLength(1);
  expect(acts[0]).toMatchObject({ actor_user_id: s.user.id, meta: { reason: REASON } });
});

it("accepts exactly 10 and 500 characters", async () => {
  const a = await fresh();
  expect((await reject(a.token, a.id, { reason: "r".repeat(10) })).status).toBe(200);
  const b = await fresh();
  expect((await reject(b.token, b.id, { reason: "r".repeat(500) })).status).toBe(200);
});

it("lets the staffing company reject its own contract", async () => {
  const s = await fresh({ staffing: true });
  expect((await reject(s.token, s.id, { reason: REASON })).status).toBe(200);
  expect((await db.Contract.findByPk(s.id)).status).toBe("REJECTED");
});

it.each([
  [{}, "contractReasonRequired"],
  [{ reason: "   " }, "contractReasonRequired"],
  [{ reason: "r".repeat(9) }, "contractReasonMin"],
  [{ reason: "r".repeat(501) }, "contractReasonMax"],
  [{ reason: "Not acceptable 😀 at all" }, "noEmojis"],
])("400 for %j", async (body, key) => {
  const s = await fresh();
  const res = await reject(s.token, s.id, body);
  expect(res.status).toBe(400);
  expect(res.body).toEqual(validationBody({ reason: key }));
  expect((await db.Contract.findByPk(s.id)).status).toBe("SENT");
});

it("answers in Arabic", async () => {
  const s = await fresh();
  expect((await reject(s.token, s.id, { reason: "short" }, "ar")).body).toEqual(validationBody({ reason: "contractReasonMin" }, "ar"));
});

it.each([
  ["EXPIRED", "CONTRACT_EXPIRED"],
  ["REVOKED", "CONTRACT_REVOKED"],
  ["SUBMITTED", "CONTRACT_ALREADY_SIGNED"],
  ["COMPLETED", "CONTRACT_ALREADY_SIGNED"],
  ["REJECTED", "CONTRACT_STATUS_INVALID"],
])("a %s contract → 409 %s", async (status, code) => {
  const s = await fresh();
  await db.Contract.update({ status }, { where: { id: s.id } });
  const res = await reject(s.token, s.id, { reason: REASON });
  expect(res.status).toBe(409);
  expect(res.body).toEqual(errorBody(code));
});

it("refuses a contract past its sign-by time before the job runs, and checks state before the body", async () => {
  const s = await fresh();
  await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: s.id } });
  const res = await reject(s.token, s.id, {});
  expect(res.status).toBe(409);
  expect(res.body).toEqual(errorBody("CONTRACT_EXPIRED"));
  expect((await db.Contract.findByPk(s.id)).status).toBe("EXPIRED");
});

it("refuses an inactive signer → 409 CONTRACT_RECIPIENT_INACTIVE", async () => {
  const s = await fresh();
  await s.employee.update({ employment_status: "EXITED" });
  const res = await reject(s.token, s.id, { reason: REASON });
  expect(res.status).toBe(409);
  expect(res.body).toEqual(errorBody("CONTRACT_RECIPIENT_INACTIVE"));
});

it("lets exactly one of a reject and a submit running at once succeed", async () => {
  const s = await fresh();
  const fields = await db.ContractField.findAll({ where: { contract_id: s.id } });
  const sigId = fields.find((x) => x.field_type === "SIGNATURE").id;
  const [r, sub] = await Promise.all([
    reject(s.token, s.id, { reason: REASON }),
    post(s.token, s.id, "submit", { consent: true, fields: { [sigId]: { type: "TYPED", text: "Signer Name" } } }),
  ]);
  expect([r.status, sub.status].sort()).toEqual([200, 409]);
  const loser = r.status === 409 ? r : sub;
  const final = (await db.Contract.findByPk(s.id)).status;
  expect(loser.body).toEqual(errorBody(final === "REJECTED" ? "CONTRACT_STATUS_INVALID" : "CONTRACT_ALREADY_SIGNED"));
});

it("404 for anyone other than the signer, and nothing changes", async () => {
  const s = await fresh();
  const other = await createEmployee(ctx.employer);
  const { user: staffUser } = await createStaffingCompany(ctx.employer);
  for (const token of [await loginAs(other.user.email), await loginAs(staffUser.email), ctx.token, (await h.hrLogin(ctx.employer, h.ALL_FLAGS)).token]) {
    const res = await reject(token, s.id, { reason: REASON });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  }
  expect((await db.Contract.findByPk(s.id)).status).toBe("SENT");
});

it("lets HR send a new contract of the same type to that recipient after the rejection", async () => {
  const s = await fresh();
  await reject(s.token, s.id, { reason: REASON });
  const res = await createContracts(ctx.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: [s.employee.id], ...terms() });
  expect(res.body.data.results[0].result).toBe("SENT");
});

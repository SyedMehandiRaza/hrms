const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");
const { runContractJob } = require("../src/jobs/contractJob");
const { endOfDayUtc, addDays } = require("../src/utils/companyTime");

const { db, createEmployee, createStaffingCompany } = h;
const { setupCompany, createContracts, terms } = f;

// Expiry, reminder and inactive-recipient job (ticket contract-studio#13; plan decisions 36, 41, 43).

afterAll(() => db.sequelize.close());

const HOUR = 3600 * 1000;
const send = async (ctx, ids, overrides = {}) =>
  (await createContracts(ctx.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: ids, ...terms(), ...overrides })).body.data.results.map((r) => r.contractId);
const sendStaffing = async (ctx, ids) =>
  (await createContracts(ctx.token, { mode: "SEND", templateId: ctx.staffingTemplate.id, recipientIds: ids, ...terms() })).body.data.results.map((r) => r.contractId);
const newEmp = async (ctx, overrides = {}, opts) => (await createEmployee(ctx.employer, overrides, opts)).employee;
const activities = (id, action) => db.ContractActivity.findAll({ where: { contract_id: id, action } });
const reload = (id) => db.Contract.findByPk(id);
const recipientStatus = async (id) => (await db.ContractRecipient.findOne({ where: { contract_id: id } })).status;


describe("expiry", () => {
  let ctx;
  beforeAll(async () => {
    ctx = await setupCompany();
  });

  it("expires SENT and VIEWED contracts past their expiry, with an EXPIRED activity and no actor", async () => {
    const [a, b] = await send(ctx, [(await newEmp(ctx)).id, (await newEmp(ctx)).id]);
    await db.Contract.update({ status: "VIEWED" }, { where: { id: b } });
    const after = new Date((await reload(a)).expires_at.getTime() + 1000);
    await runContractJob({ now: after });
    for (const id of [a, b]) {
      expect((await reload(id)).status).toBe("EXPIRED");
      expect(await recipientStatus(id)).toBe("EXPIRED");
      const acts = await activities(id, "EXPIRED");
      expect(acts).toHaveLength(1);
      expect(acts[0].actor_user_id).toBeNull();
    }
  });

  it("leaves a SUBMITTED contract alone past its sign-by date", async () => {
    const [id] = await send(ctx, [(await newEmp(ctx)).id]);
    await db.Contract.update({ status: "SUBMITTED" }, { where: { id } });
    await runContractJob({ now: new Date((await reload(id)).expires_at.getTime() + 10 * HOUR) });
    expect((await reload(id)).status).toBe("SUBMITTED");
  });

  it("uses the end of the sign-by day in Riyadh: 23:00 there → still open; 00:05 next day → expired", async () => {
    const signBy = f.inDays(3);
    const [id] = await send(ctx, [(await newEmp(ctx)).id], { sign_by: signBy });
    const midnight = endOfDayUtc(signBy, "Asia/Riyadh"); // 00:00 Riyadh on the next day
    // Riyadh is UTC+3: 00:00 on the next day there is 21:00 UTC on the sign-by day.
    expect(midnight.toISOString()).toBe(`${signBy}T21:00:00.000Z`);
    expect(addDays(signBy, 1) > signBy).toBe(true);
    await runContractJob({ now: new Date(midnight.getTime() - HOUR) }); // 23:00 Riyadh
    expect((await reload(id)).status).toBe("SENT");
    await runContractJob({ now: new Date(midnight.getTime() + 5 * 60 * 1000) }); // 00:05 Riyadh
    expect((await reload(id)).status).toBe("EXPIRED");
  });

  it("never touches COMPLETED, REJECTED, EXPIRED or REVOKED contracts", async () => {
    const ids = await send(ctx, [(await newEmp(ctx)).id, (await newEmp(ctx)).id, (await newEmp(ctx)).id, (await newEmp(ctx)).id]);
    const statuses = ["COMPLETED", "REJECTED", "EXPIRED", "REVOKED"];
    for (const [i, id] of ids.entries()) await db.Contract.update({ status: statuses[i], expires_at: new Date(Date.now() - HOUR) }, { where: { id } });
    const before = await db.Contract.findAll({ where: { id: ids }, raw: true, order: [["id", "ASC"]] });
    await runContractJob({ now: new Date(Date.now() + 100 * HOUR) });
    expect(await db.Contract.findAll({ where: { id: ids }, raw: true, order: [["id", "ASC"]] })).toEqual(before);
  });

  it("changes each contract once when two runs overlap, or a run meets a request's lazy expiry", async () => {
    const [a, b] = await send(ctx, [(await newEmp(ctx)).id, (await newEmp(ctx)).id]);
    await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: [a, b] } });
    await Promise.all([runContractJob(), runContractJob(), h.api.get(`/contracts/${b}`, ctx.token)]);
    for (const id of [a, b]) expect(await activities(id, "EXPIRED")).toHaveLength(1);
  });
});

describe("reminders", () => {
  let ctx;
  beforeAll(async () => {
    ctx = await setupCompany();
  });

  it("records one reminder when a SENT or VIEWED contract is within 48 hours of expiry and was sent more than 48 hours before it", async () => {
    const [id] = await send(ctx, [(await newEmp(ctx)).id], { sign_by: f.inDays(7) });
    const c = await reload(id);
    const now = new Date(c.expires_at.getTime() - 47 * HOUR);
    await runContractJob({ now });
    const fresh = await reload(id);
    expect(fresh.reminder_sent_at.toISOString()).toBe(new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString());
    expect(await activities(id, "REMINDED")).toHaveLength(1);
    await runContractJob({ now: new Date(now.getTime() + HOUR) });
    expect(await activities(id, "REMINDED")).toHaveLength(1);
  });

  it("doesn't remind earlier than 48 hours before expiry", async () => {
    const [id] = await send(ctx, [(await newEmp(ctx)).id], { sign_by: f.inDays(7) });
    await runContractJob({ now: new Date((await reload(id)).expires_at.getTime() - 49 * HOUR) });
    expect(await activities(id, "REMINDED")).toHaveLength(0);
  });

  it("never reminds a contract sent with less than 48 hours to its expiry", async () => {
    const [id] = await send(ctx, [(await newEmp(ctx)).id], { sign_by: f.inDays(1) });
    const c = await reload(id);
    if (c.expires_at.getTime() - c.sent_at.getTime() <= 48 * HOUR) {
      await runContractJob({ now: new Date(c.expires_at.getTime() - HOUR) });
      expect(await activities(id, "REMINDED")).toHaveLength(0);
    }
  });

  it("doesn't remind a SUBMITTED contract", async () => {
    const [id] = await send(ctx, [(await newEmp(ctx)).id], { sign_by: f.inDays(7) });
    await db.Contract.update({ status: "SUBMITTED" }, { where: { id } });
    await runContractJob({ now: new Date((await reload(id)).expires_at.getTime() - 24 * HOUR) });
    expect(await activities(id, "REMINDED")).toHaveLength(0);
  });
});

describe("recipients who left", () => {
  let ctx;
  beforeAll(async () => {
    ctx = await setupCompany();
  });

  const expectRevoked = async (id) => {
    const c = await reload(id);
    expect(c).toMatchObject({ status: "REVOKED", revoke_reason: "Recipient is no longer active.", revoked_by: null });
    expect(await recipientStatus(id)).toBe("REVOKED");
    expect(c.revoked_at).toBeInstanceOf(Date);
    const acts = await activities(id, "REVOKED");
    expect(acts).toHaveLength(1);
    expect(acts[0].actor_user_id).toBeNull();
    expect(acts[0].meta).toMatchObject({ reason: "Recipient is no longer active." });
  };

  it.each(["SENT", "VIEWED", "SUBMITTED"])("auto-revokes a %s contract of an exited employee", async (status) => {
    const e = await newEmp(ctx);
    const [id] = await send(ctx, [e.id]);
    await db.Contract.update({ status }, { where: { id } });
    await e.update({ employment_status: "EXITED" });
    await runContractJob();
    await expectRevoked(id);
  });

  it("auto-revokes for a deleted employee and for an ended account", async () => {
    const a = await newEmp(ctx);
    const b = await newEmp(ctx);
    const [ia, ib] = await send(ctx, [a.id, b.id]);
    await a.destroy();
    await db.HrmsAccount.update({ status: "INACTIVE" }, { where: { user_id: b.user_id } });
    await runContractJob();
    await expectRevoked(ia);
    await expectRevoked(ib);
  });

  it("auto-revokes for a staffing company that is inactive, deleted, has no login, or whose login ended", async () => {
    const make = async () => (await createStaffingCompany(ctx.employer)).company;
    const [s1, s2, s3, s4] = [await make(), await make(), await make(), await make()];
    const ids = await sendStaffing(ctx, [s1.id, s2.id, s3.id, s4.id]);
    await s1.update({ status: "INACTIVE" });
    await s2.destroy();
    const s4user = s4.user_id;
    await s3.update({ user_id: null });
    await db.HrmsAccount.update({ status: "INACTIVE" }, { where: { user_id: s4user } });
    await runContractJob();
    for (const id of ids) await expectRevoked(id);
  });

  it("leaves IN_NOTICE employees and suspended accounts alone", async () => {
    const a = await newEmp(ctx);
    const b = await newEmp(ctx);
    const ids = await send(ctx, [a.id, b.id]);
    await a.update({ employment_status: "IN_NOTICE" });
    await db.HrmsAccount.update({ status: "SUSPENDED" }, { where: { user_id: b.user_id } });
    await runContractJob();
    for (const id of ids) expect((await reload(id)).status).toBe("SENT");
  });

  it("never changes COMPLETED or REJECTED contracts of a recipient who left", async () => {
    const e = await newEmp(ctx);
    const ids = await send(ctx, [e.id]);
    const [other] = await send(ctx, [e.id], { templateId: (await f.makeTemplate(ctx.employer, { document: ctx.document, type: ctx.staffType })).id });
    await db.Contract.update({ status: "COMPLETED" }, { where: { id: ids[0] } });
    await db.Contract.update({ status: "REJECTED" }, { where: { id: other } });
    await e.update({ employment_status: "EXITED" });
    await runContractJob();
    expect((await reload(ids[0])).status).toBe("COMPLETED");
    expect((await reload(other)).status).toBe("REJECTED");
  });

  it("revokes each contract once when runs overlap, and changes no employee or staffing row", async () => {
    const e = await newEmp(ctx);
    const [id] = await send(ctx, [e.id]);
    await e.update({ employment_status: "EXITED" });
    const before = await db.Employee.findByPk(e.id, { raw: true });
    await Promise.all([runContractJob(), runContractJob()]);
    expect(await activities(id, "REVOKED")).toHaveLength(1);
    expect(await db.Employee.findByPk(e.id, { raw: true })).toEqual(before);
  });
});

describe("scheduling", () => {
  it("runs directly from tests without waiting for the schedule, and the hourly schedule is '0 * * * *'", () => {
    const { SCHEDULE } = require("../src/jobs/contractJob");
    expect(SCHEDULE).toBe("0 * * * *");
    expect(typeof runContractJob).toBe("function");
  });
});

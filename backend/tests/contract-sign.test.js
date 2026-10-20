const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contract-sign-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;
process.env.TRUST_PROXY = "1";

const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");
const { makePng, dataUrl } = require("./helpers/pdf");
const { valuesSha256 } = require("../src/services/contractMerge.service");

const { db, api, errorBody, validationBody, createEmployee, createStaffingCompany, loginAs } = h;
const { setupCompany, createContracts, terms, makeTemplate, mergeField, sig, attachSampleFile } = f;

// Sign (submit): fields, signatures, consent, write-once evidence, races
// (ticket contract-studio#10; plan decisions 29, 31–32, 37).

afterAll(async () => {
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

const CONSENT = "I agree that my electronic signature is legally binding, the same as a handwritten signature.";
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const submit = (token, id, body, { lang, headers = {} } = {}) => {
  let req = h.withAuth(h.request(h.app).post(`/api/my/contracts/${id}/submit`), token, lang);
  Object.entries(headers).forEach(([k, v]) => {
    req = req.set(k, v);
  });
  return req.send(body);
};
const signatureFiles = (employerId) => {
  const dir = path.join(STORAGE_DIR, employerId, "signatures");
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

// A company with a template holding every signer field type.
const FIELDS = [
  mergeField("EMPLOYEE", "employee_name"),
  { field_type: "INPUT", page_no: 1, pos_x: 0.1, pos_y: 0.4, width: 0.5, height: 0.03, label: "Bank IBAN", is_required: true },
  { field_type: "INPUT", page_no: 1, pos_x: 0.1, pos_y: 0.45, width: 0.5, height: 0.03, label: "Notes", is_required: false },
  { field_type: "CHECKBOX", page_no: 2, pos_x: 0.1, pos_y: 0.4, width: 0.03, height: 0.02, label: "I accept the terms", is_required: true },
  { field_type: "CHECKBOX", page_no: 2, pos_x: 0.1, pos_y: 0.45, width: 0.03, height: 0.02, label: "Newsletter", is_required: false },
  { field_type: "DATE", page_no: 3, pos_x: 0.2, pos_y: 0.245, width: 0.25, height: 0.03, label: "Date", is_required: true },
  { field_type: "INITIALS", page_no: 3, pos_x: 0.6, pos_y: 0.245, width: 0.1, height: 0.04, label: "Initials", is_required: true },
  sig(),
];

let ctx;
let template;
beforeAll(async () => {
  ctx = await setupCompany();
  await attachSampleFile(ctx.document);
  template = await makeTemplate(ctx.employer, { document: ctx.document, type: ctx.type, fields: FIELDS });
});

// A fresh signer with one SENT contract (own type each time, so contracts never collide).
const fresh = async ({ overrides = {}, staffing = false } = {}) => {
  if (staffing) {
    const { user, company } = await createStaffingCompany(ctx.employer, { name: "Gulf Manpower" });
    const res = await createContracts(ctx.token, { mode: "SEND", templateId: ctx.staffingTemplate.id, recipientIds: [company.id], ...terms() });
    return { user, company, token: await loginAs(user.email), id: res.body.data.results[0].contractId };
  }
  const { user, employee } = await createEmployee(ctx.employer, { full_name: "Sara Khan", ...overrides });
  const type = await db.ContractType.create({ employer_id: ctx.employer.id, name: `T ${h.short()}`, code: `T${h.short()}` });
  await template.update({ contract_type_id: type.id });
  const res = await createContracts(ctx.token, { mode: "SEND", templateId: template.id, recipientIds: [employee.id], ...terms() });
  const id = res.body.data.results[0].contractId;
  const fields = await db.ContractField.findAll({ where: { contract_id: id } });
  const byLabel = Object.fromEntries(fields.map((x) => [x.label, x.id]));
  return { user, employee, token: await loginAs(user.email), id, fields, byLabel };
};

const validBody = (s, overrides = {}) => ({
  consent: true,
  fields: {
    [s.byLabel["Bank IBAN"]]: "SA0380000000608010167519",
    [s.byLabel["I accept the terms"]]: true,
    [s.byLabel.Date]: "2026-10-20",
    [s.byLabel.Initials]: { type: "TYPED", text: "SK" },
    [s.byLabel.Signature]: { type: "DRAWN", dataUrl: dataUrl(makePng(120, 40)) },
    ...overrides,
  },
});

describe("submit", () => {
  it("submits: contract and recipient SUBMITTED, values stored, evidence written once, SIGNED activity", async () => {
    const s = await fresh();
    const png = makePng(120, 40);
    const res = await submit(s.token, s.id, validBody(s, { [s.byLabel.Signature]: { type: "DRAWN", dataUrl: dataUrl(png) } }), {
      headers: { "User-Agent": "Mozilla/5.0 (Sign Test)" },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: s.id, status: "SUBMITTED" });

    const c = await db.Contract.findByPk(s.id, { include: ["contractRecipients", "contractFields"] });
    expect(c.status).toBe("SUBMITTED");
    expect(c.submitted_at).toBeInstanceOf(Date);
    const r = c.contractRecipients[0];
    expect(r).toMatchObject({ status: "SUBMITTED", signed_user_agent: "Mozilla/5.0 (Sign Test)" });
    expect(r.signed_at).toBeInstanceOf(Date);

    const values = Object.fromEntries(c.contractFields.map((x) => [x.label, x.value]));
    expect(values["Bank IBAN"]).toBe("SA0380000000608010167519");
    expect(values["I accept the terms"]).toBe("true");
    expect(values.Newsletter).toBeNull();
    expect(values.Notes).toBeNull();
    expect(values.Date).toBe("2026-10-20");
    expect(JSON.parse(values.Initials)).toEqual({ type: "TYPED", text: "SK" });
    const drawn = JSON.parse(values.Signature);
    expect(drawn).toMatchObject({ type: "DRAWN", sha256: sha(png) });
    expect(fs.readFileSync(path.join(STORAGE_DIR, drawn.path)).equals(png)).toBe(true);
    expect(drawn.path).toMatch(new RegExp(`^${ctx.employer.id}/signatures/[0-9a-f-]{36}\\.png$`));

    const ev = r.evidence;
    expect(ev).toMatchObject({
      account_id: expect.any(String),
      user_id: s.user.id,
      employee_id: s.employee.id,
      profile_name: "Sara Khan",
      ip: r.signed_ip,
      user_agent: "Mozilla/5.0 (Sign Test)",
      consent_text: CONSENT,
      consent_version: "v1",
      document_sha256: (await ctx.document.reload()).file_sha256,
    });
    expect(new Date(ev.signed_at).toISOString()).toBe(ev.signed_at);
    expect(ev.signatures).toEqual(
      expect.arrayContaining([
        { field_id: s.byLabel.Signature, type: "DRAWN", path: drawn.path, sha256: sha(png) },
        { field_id: s.byLabel.Initials, type: "TYPED", text: "SK" },
      ])
    );
    // The values hash reproduces from the stored values (drawn → image SHA-256).
    const entries = c.contractFields.map((x) => ({
      id: x.id,
      field_type: x.field_type,
      value: (x.field_type === "SIGNATURE" || x.field_type === "INITIALS") && JSON.parse(x.value || "null")?.type === "DRAWN" ? JSON.parse(x.value).sha256 : x.value,
    }));
    expect(ev.values_sha256).toBe(valuesSha256(entries));

    const signed = await db.ContractActivity.findAll({ where: { contract_id: s.id, action: "SIGNED" } });
    expect(signed).toHaveLength(1);
    expect(signed[0].actor_user_id).toBe(s.user.id);
    expect(signed[0].meta).toMatchObject({ profile_name: "Sara Khan", values_sha256: ev.values_sha256 });
  });

  it("submits for the staffing company with its id in the evidence", async () => {
    const s = await fresh({ staffing: true });
    const fields = await db.ContractField.findAll({ where: { contract_id: s.id } });
    const sigId = fields.find((x) => x.field_type === "SIGNATURE").id;
    const res = await submit(s.token, s.id, { consent: true, fields: { [sigId]: { type: "TYPED", text: "Gulf Manpower" } } });
    expect(res.status).toBe(200);
    const r = await db.ContractRecipient.findOne({ where: { contract_id: s.id } });
    expect(r.evidence).toMatchObject({ staffing_company_id: s.company.id, profile_name: "Gulf Manpower", user_id: s.user.id });
    expect(r.evidence).not.toHaveProperty("employee_id");
  });

  it("records the client address from X-Forwarded-For behind a trusted proxy", async () => {
    const s = await fresh();
    await submit(s.token, s.id, validBody(s), { headers: { "X-Forwarded-For": "203.0.113.9" } });
    const r = await db.ContractRecipient.findOne({ where: { contract_id: s.id } });
    expect(r.signed_ip).toBe("203.0.113.9");
    expect(r.evidence.ip).toBe("203.0.113.9");
  });

  it("accepts a typed signature that differs from the profile name, still recording the profile name", async () => {
    const s = await fresh();
    await submit(s.token, s.id, validBody(s, { [s.byLabel.Signature]: { type: "TYPED", text: "S. Khan" } }));
    const r = await db.ContractRecipient.findOne({ where: { contract_id: s.id } });
    expect(r.evidence.profile_name).toBe("Sara Khan");
    expect(r.evidence.signatures).toEqual(expect.arrayContaining([{ field_id: s.byLabel.Signature, type: "TYPED", text: "S. Khan" }]));
  });

  it("ignores unknown field ids and merge-field ids in the body", async () => {
    const s = await fresh();
    const mergeId = s.fields.find((x) => x.field_type === "DB_COLUMN").id;
    const res = await submit(s.token, s.id, validBody(s, { [mergeId]: "Hacked Name", [crypto.randomUUID()]: "x" }));
    expect(res.status).toBe(200);
    expect((await db.ContractField.findByPk(mergeId)).value).toBe("Sara Khan");
  });

  it("never writes profile signature columns on employees or staffing companies", async () => {
    const s = await fresh();
    await submit(s.token, s.id, validBody(s));
    const e = await db.Employee.findByPk(s.employee.id);
    expect([e.signature_url, e.signature_type, e.signature_updated_at]).toEqual([null, null, null]);
    const st = await fresh({ staffing: true });
    const sigId = (await db.ContractField.findAll({ where: { contract_id: st.id } })).find((x) => x.field_type === "SIGNATURE").id;
    await submit(st.token, st.id, { consent: true, fields: { [sigId]: { type: "DRAWN", dataUrl: dataUrl(makePng(50, 20)) } } });
    const c = await db.StaffingCompany.findByPk(st.company.id);
    expect([c.signature_url, c.signature_type, c.signature_updated_at]).toEqual([null, null, null]);
  });
});

describe("validation", () => {
  let s;
  beforeAll(async () => {
    s = await fresh();
  });
  const expectFields = async (body, fields, lang) => {
    const res = await submit(s.token, s.id, body, { lang });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(fields, lang));
  };

  it("refuses a missing or non-true consent → 400 CONTRACT_CONSENT_REQUIRED", async () => {
    for (const consent of [undefined, false, "true", 1]) {
      const res = await submit(s.token, s.id, { ...validBody(s), consent });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(errorBody("CONTRACT_CONSENT_REQUIRED"));
    }
  });

  it("lists every empty required field as 'This field is required'", async () => {
    await expectFields({ consent: true, fields: {} }, {
      [s.byLabel["Bank IBAN"]]: "fieldRequired",
      [s.byLabel["I accept the terms"]]: "fieldRequired",
      [s.byLabel.Date]: "fieldRequired",
      [s.byLabel.Initials]: "fieldRequired",
      [s.byLabel.Signature]: "fieldRequired",
    });
  });

  it("answers in Arabic", async () => {
    await expectFields({ ...validBody(s), fields: { ...validBody(s).fields, [s.byLabel.Date]: "2026-02-30" } }, { [s.byLabel.Date]: "dateInvalid" }, "ar");
  });

  it.each([
    ["a date that isn't real", "Date", "2026-02-30", "dateInvalid"],
    ["a date in another format", "Date", "20/10/2026", "dateInvalid"],
    ["a required checkbox left false", "I accept the terms", false, "fieldRequired"],
    ["a 501-character input", "Bank IBAN", "x".repeat(501), "inputMax500"],
    ["an input with an emoji", "Bank IBAN", "IBAN 😀", "noEmojis"],
    ["a 1-character typed signature", "Signature", { type: "TYPED", text: "S" }, "signatureLength"],
    ["a 101-character typed signature", "Signature", { type: "TYPED", text: "s".repeat(101) }, "signatureLength"],
    ["a typed signature with an emoji", "Signature", { type: "TYPED", text: "Sara 😀" }, "noEmojis"],
    ["11-character initials", "Initials", { type: "TYPED", text: "ABCDEFGHIJK" }, "initialsLength"],
    ["initials with an emoji", "Initials", { type: "TYPED", text: "😀" }, "noEmojis"],
    ["a signature of the wrong shape", "Signature", { kind: "x" }, "signatureImageInvalid"],
    ["a signature as a plain string", "Signature", "Sara", "signatureImageInvalid"],
    ["a drawn signature that isn't a PNG", "Signature", { type: "DRAWN", dataUrl: `data:image/png;base64,${Buffer.from("GIF89a fake").toString("base64")}` }, "signatureImageInvalid"],
    ["a drawn signature without a data URL", "Signature", { type: "DRAWN", dataUrl: "https://example.com/a.png" }, "signatureImageInvalid"],
  ])("refuses %s", async (_, label, value, key) => {
    await expectFields(validBody(s, { [s.byLabel[label]]: value }), { [s.byLabel[label]]: key });
  });

  it("refuses a drawn image over 500 KB decoded; accepts one just under", async () => {
    const { pngOfSize } = require("./helpers/pdf");
    const big = pngOfSize(520 * 1024);
    expect(big.length).toBeGreaterThan(500 * 1024);
    await expectFields(validBody(s, { [s.byLabel.Signature]: { type: "DRAWN", dataUrl: dataUrl(big) } }), { [s.byLabel.Signature]: "signatureImageInvalid" });
  });

  it("accepts 1-character initials, an optional checkbox left false and empty optional fields", async () => {
    const t = await fresh();
    const res = await submit(t.token, t.id, validBody(t, { [t.byLabel.Initials]: { type: "TYPED", text: "S" }, [t.byLabel.Newsletter]: false, [t.byLabel.Notes]: "" }));
    expect(res.status).toBe(200);
  });

  it("checks state before the body: an expired contract with no consent and empty fields → 409 CONTRACT_EXPIRED", async () => {
    const t = await fresh();
    await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: t.id } });
    const res = await submit(t.token, t.id, { fields: {} });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_EXPIRED"));
    expect((await db.Contract.findByPk(t.id)).status).toBe("EXPIRED");
    expect(await db.ContractActivity.count({ where: { contract_id: t.id, action: "EXPIRED" } })).toBe(1);
  });
});

describe("body size", () => {
  it("accepts 20 drawn signatures of up to 500 KB each (a body over 1 MB)", async () => {
    const fields = Array.from({ length: 20 }, (_, i) => sig({ label: `Sig ${i}`, pos_y: 0.03 + i * 0.045, height: 0.04 }));
    const t20 = await makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `Many ${h.short()}`, code: `M${h.short()}` }), fields });
    const { user, employee } = await createEmployee(ctx.employer);
    const id = (await createContracts(ctx.token, { mode: "SEND", templateId: t20.id, recipientIds: [employee.id], ...terms() })).body.data.results[0].contractId;
    const { pngOfSize } = require("./helpers/pdf");
    const png = pngOfSize(480 * 1024);
    expect(png.length).toBeLessThanOrEqual(500 * 1024);
    const ids = (await db.ContractField.findAll({ where: { contract_id: id } })).map((x) => x.id);
    const body = { consent: true, fields: Object.fromEntries(ids.map((fid) => [fid, { type: "DRAWN", dataUrl: dataUrl(png) }])) };
    expect(JSON.stringify(body).length).toBeGreaterThan(1024 * 1024);
    const res = await submit(await loginAs(user.email), id, body);
    expect(res.status).toBe(200);
  });

  it("refuses a body over 15 MB → 413 PAYLOAD_TOO_LARGE", async () => {
    const s = await fresh();
    const res = await submit(s.token, s.id, { consent: true, fields: { x: "y".repeat(15 * 1024 * 1024 + 10) } });
    expect(res.status).toBe(413);
    expect(res.body).toEqual(errorBody("PAYLOAD_TOO_LARGE"));
  });

  it("keeps the 1 MB limit on other routes", async () => {
    const res = await api.post("/contract-types", ctx.token, { name: "x".repeat(1100 * 1024), code: "BIG" });
    expect(res.status).toBe(413);
    expect(res.body).toEqual(errorBody("PAYLOAD_TOO_LARGE"));
  });
});

describe("states and races", () => {
  it("stores one signature when the signer submits twice or two submits run at once; the other gets 409", async () => {
    const s = await fresh();
    const [a, b] = await Promise.all([submit(s.token, s.id, validBody(s)), submit(s.token, s.id, validBody(s))]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((a.status === 409 ? a : b).body).toEqual(errorBody("CONTRACT_ALREADY_SIGNED"));
    expect(await db.ContractActivity.count({ where: { contract_id: s.id, action: "SIGNED" } })).toBe(1);
    expect(signatureFiles(ctx.employer.id).filter((n) => n.endsWith(".png")).length).toBeGreaterThan(0);
    const again = await submit(s.token, s.id, validBody(s));
    expect(again.body).toEqual(errorBody("CONTRACT_ALREADY_SIGNED"));
  });

  it.each([
    ["COMPLETED", "CONTRACT_ALREADY_SIGNED"],
    ["REJECTED", "CONTRACT_STATUS_INVALID"],
    ["REVOKED", "CONTRACT_REVOKED"],
    ["EXPIRED", "CONTRACT_EXPIRED"],
  ])("a %s contract → %s", async (status, code) => {
    const s = await fresh();
    await db.Contract.update({ status }, { where: { id: s.id } });
    const res = await submit(s.token, s.id, validBody(s));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody(code));
  });

  it.each([
    ["exited", async (s) => s.employee.update({ employment_status: "EXITED" })],
    ["with an ended account (session still open)", async (s) => db.HrmsAccount.update({ status: "INACTIVE" }, { where: { user_id: s.user.id } })],
  ])("an %s signer → 409 CONTRACT_RECIPIENT_INACTIVE", async (_, change) => {
    const s = await fresh();
    await change(s);
    const res = await submit(s.token, s.id, validBody(s));
    if (res.status === 403) {
      // An ended account can't use its session any more (requireAuth) — also nothing signed.
      expect(res.body.code).toBe("AUTH_ACCOUNT_INACTIVE");
    } else {
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("CONTRACT_RECIPIENT_INACTIVE"));
    }
    expect((await db.Contract.findByPk(s.id)).status).toBe("SENT");
  });

  it("a staffing company whose login's account ended but whose session is still open → refused, nothing signed", async () => {
    const s = await fresh({ staffing: true });
    await s.company.update({ status: "INACTIVE" });
    const sigId = (await db.ContractField.findAll({ where: { contract_id: s.id } })).find((x) => x.field_type === "SIGNATURE").id;
    const res = await submit(s.token, s.id, { consent: true, fields: { [sigId]: { type: "TYPED", text: "Gulf" } } });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_RECIPIENT_INACTIVE"));
  });

  it("500 and no image left behind when saving fails after the images were written", async () => {
    const s = await fresh();
    const before = signatureFiles(ctx.employer.id).length;
    const spy = jest.spyOn(db.ContractActivity, "create").mockRejectedValueOnce(new Error("disk full"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await submit(s.token, s.id, validBody(s));
    spy.mockRestore();
    log.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual(errorBody("INTERNAL_ERROR"));
    expect((await db.Contract.findByPk(s.id)).status).toBe("SENT");
    expect(signatureFiles(ctx.employer.id).length).toBe(before);
  });

  it("404 for anyone other than the signer, and nothing changes", async () => {
    const s = await fresh();
    const other = await createEmployee(ctx.employer);
    const { user: staffUser } = await createStaffingCompany(ctx.employer);
    for (const token of [await loginAs(other.user.email), await loginAs(staffUser.email), ctx.token, (await h.hrLogin(ctx.employer, h.ALL_FLAGS)).token]) {
      const res = await submit(token, s.id, validBody(s));
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
    expect((await db.Contract.findByPk(s.id)).status).toBe("SENT");
  });
});

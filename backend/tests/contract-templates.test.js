const h = require("./helpers/contracts");

const { db, api, errorBody, validationBody, createCompany, hrLogin, ownerToken, createEmployee, createStaffingCompany } = h;

// Templates and merge-field catalogue API (ticket contract-studio#05; plan decisions 9–14, 44).

afterAll(() => db.sequelize.close());

const catalogue = (token, audience) => api.get("/contract-merge-fields", token, { query: audience ? { audience } : {} });
const list = (token, query) => api.get("/contract-templates", token, { query });
const create = (token, body) => api.post("/contract-templates", token, body);
const get = (token, id) => api.get(`/contract-templates/${id}`, token);
const update = (token, id, body) => api.put(`/contract-templates/${id}`, token, body);
const remove = (token, id) => api.delete(`/contract-templates/${id}`, token);
const duplicate = (token, id) => api.post(`/contract-templates/${id}/duplicate`, token, {});
const setStatus = (token, id, status) => api.patch(`/contract-templates/${id}/status`, token, { status });

const newDocument = (employer, overrides = {}) =>
  db.ContractDocument.create({ employer_id: employer.id, name: `Doc ${h.short()}`, page_count: 3, status: "SAVED", ...overrides });
const newType = (employer, overrides = {}) =>
  db.ContractType.create({ employer_id: employer.id, name: `Type ${h.short()}`, code: `T${h.short()}`.toUpperCase(), ...overrides });

const sig = (overrides = {}) => ({ field_type: "SIGNATURE", page_no: 3, pos_x: 0.2, pos_y: 0.7, width: 0.3, height: 0.06, label: "Signature", is_required: true, ...overrides });
const input = (overrides = {}) => ({ field_type: "INPUT", page_no: 1, pos_x: 0.1, pos_y: 0.2, width: 0.3, height: 0.03, label: "Notes", is_required: false, ...overrides });
const merge = (db_source, db_column, overrides = {}) => ({ field_type: "DB_COLUMN", page_no: 1, pos_x: 0.1, pos_y: 0.1, width: 0.4, height: 0.03, db_source, db_column, is_required: true, ...overrides });

describe("merge-field catalogue", () => {
  let token;
  beforeAll(async () => {
    token = await ownerToken(await createCompany());
  });

  it("EMPLOYEE → the Employee and Contract groups", async () => {
    const res = await catalogue(token, "EMPLOYEE");
    expect(res.status).toBe(200);
    expect(res.body.data.map((g) => g.group)).toEqual(["Employee", "Contract"]);
    const employee = res.body.data[0].fields.map((f) => f.token);
    expect(employee).toEqual(expect.arrayContaining(["employee_name", "employee_code", "designation", "project", "staffing_company", "company_name"]));
    expect(employee).not.toContain("salary");
    expect(employee).not.toContain("job_title");
    expect(res.body.data[1].fields.map((f) => f.token)).toEqual(["contract_no", "contract_type", "start_date", "end_date", "rate", "notice_period", "sent_date"]);
  });

  it("STAFFING_COMPANY → the Staffing Company and Contract groups", async () => {
    const res = await catalogue(token, "STAFFING_COMPANY");
    expect(res.body.data.map((g) => g.group)).toEqual(["Staffing Company", "Contract"]);
    expect(res.body.data[0].fields.map((f) => f.token)).toEqual(expect.arrayContaining(["company_name", "contact_person_name", "employer_name"]));
  });

  it.each(["VENDOR", "CLIENT", "COLLABORATING_COMPANY", undefined])("%s → 400 CONTRACT_AUDIENCE_UNSUPPORTED", async (audience) => {
    const res = await catalogue(token, audience);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_AUDIENCE_UNSUPPORTED"));
  });
});

describe("create and validate", () => {
  let company;
  let token;
  let doc;
  let type;
  const body = (overrides = {}) => ({
    name: "Employment Agreement",
    audienceType: "EMPLOYEE",
    documentId: doc.id,
    contractTypeId: type.id,
    fields: [merge("EMPLOYEE", "employee_name", { label: "" }), merge("CONTRACT", "start_date"), input(), sig()],
    ...overrides,
  });

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
    doc = await newDocument(company.employer);
    type = await newType(company.employer, { name: "Employment", code: "EMP" });
  });

  it("saves an ACTIVE template with all its fields, positions and required flags", async () => {
    const res = await create(token, body());
    expect(res.status).toBe(201);
    const t = res.body.data;
    expect(t).toMatchObject({
      name: "Employment Agreement",
      audience_type: "EMPLOYEE",
      status: "ACTIVE",
      document: { id: doc.id, name: doc.name, page_count: 3, status: "SAVED" },
      contract_type: { id: type.id, name: "Employment", code: "EMP", is_active: true },
    });
    expect(t.fields).toHaveLength(4);
    expect(t.fields[0]).toMatchObject({ field_type: "DB_COLUMN", db_source: "EMPLOYEE", db_column: "employee_name", label: "Full Name", is_required: true, page_no: 1 });
    expect(t.fields[2]).toMatchObject({ field_type: "INPUT", label: "Notes", is_required: false, pos_x: 0.1, pos_y: 0.2, width: 0.3, height: 0.03 });
    expect(t.fields[3]).toMatchObject({ field_type: "SIGNATURE", page_no: 3, is_required: true });
    const reloaded = await get(token, t.id);
    expect(reloaded.body.data.fields).toEqual(t.fields);
  });

  it("keeps the input name and the checkbox's checked value", async () => {
    const res = await create(token, body({ fields: [input({ field_key: "iban" }), input({ field_type: "CHECKBOX", label: "Accept", checked_value: "Yes" }), sig()] }));
    expect(res.status).toBe(201);
    expect(res.body.data.fields[0]).toMatchObject({ field_key: "iban", checked_value: null });
    expect(res.body.data.fields[1]).toMatchObject({ field_type: "CHECKBOX", checked_value: "Yes" });
    const tooLong = await create(token, body({ fields: [input({ field_key: "k".repeat(121) }), sig()] }));
    expect(tooLong.status).toBe(400);
  });

  it("uses the type name for an empty label of a non-merge field", async () => {
    const res = await create(token, body({ fields: [sig({ label: "" }), input({ field_type: "DATE", label: null })] }));
    expect(res.body.data.fields.map((f) => f.label)).toEqual(["Signature", "Date"]);
  });

  it.each([
    [{ name: "" }, { name: "templateNameRequired" }],
    [{ name: "n".repeat(256) }, { name: "templateNameMax" }],
    [{ documentId: undefined }, { documentId: "templateDocumentRequired" }],
    [{ documentId: "00000000-0000-4000-a000-000000000000" }, { documentId: "templateDocumentRequired" }],
    [{ fields: [] }, { fields: "templateFieldsRequired" }],
    [{ fields: [input()] }, { fields: "templateSignatureRequired" }],
    [{ fields: [input(), sig({ is_required: false })] }, { fields: "templateSignatureRequired" }],
    [{ contractTypeId: undefined }, { contractTypeId: "contractTypeRequired" }],
  ])("400 for %j", async (overrides, fields) => {
    const res = await create(token, body(overrides));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(fields));
  });

  it("refuses an inactive or another company's type with 'Choose a contract type'", async () => {
    const inactive = await newType(company.employer, { is_active: false });
    const foreign = await newType((await createCompany()).employer);
    for (const contractTypeId of [inactive.id, foreign.id]) {
      expect((await create(token, body({ contractTypeId }))).body).toEqual(validationBody({ contractTypeId: "contractTypeRequired" }));
    }
  });

  it("refuses an archived document → 409 CONTRACT_DOCUMENT_ARCHIVED", async () => {
    const archived = await newDocument(company.employer, { status: "ARCHIVED" });
    const res = await create(token, body({ documentId: archived.id }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_DOCUMENT_ARCHIVED"));
  });

  it("refuses another company's document as if missing", async () => {
    const foreign = await newDocument((await createCompany()).employer);
    expect((await create(token, body({ documentId: foreign.id }))).body).toEqual(validationBody({ documentId: "templateDocumentRequired" }));
  });

  it.each([
    ["outside the page", { pos_x: 0.8, width: 0.3 }],
    ["negative position", { pos_y: -0.01 }],
    ["too small", { width: 0.009 }],
    ["below the page", { pos_y: 0.98, height: 0.03 }],
    ["on a page the document doesn't have", { page_no: 4 }],
    ["on page 0", { page_no: 0 }],
  ])("refuses a field %s → 'Fields must sit inside the page.'", async (_, change) => {
    const res = await create(token, body({ fields: [input(change), sig()] }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ fields: "templateFieldOutsidePage" }));
  });

  it("refuses a label over 160 characters", async () => {
    const res = await create(token, body({ fields: [input({ label: "l".repeat(161) }), sig()] }));
    expect(res.body).toEqual(validationBody({ "fields.0.label": "templateLabelMax" }));
  });

  it("refuses more than 20 signature and initials fields, accepts 20", async () => {
    const many = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? sig({ field_type: "INITIALS", is_required: false }) : sig()));
    expect((await create(token, body({ fields: many(21) }))).body).toEqual(validationBody({ fields: "templateSignatureLimit" }));
    expect((await create(token, body({ fields: many(20) }))).status).toBe(201);
  });

  it("refuses more than 200 fields, accepts 200", async () => {
    const many = (n) => [sig(), ...Array.from({ length: n - 1 }, () => input())];
    expect((await create(token, body({ fields: many(201) }))).body).toEqual(validationBody({ fields: "templateFieldLimit" }));
    expect((await create(token, body({ fields: many(200) }))).status).toBe(201);
  });

  it.each([
    ["another audience", merge("STAFFING_COMPANY", "company_code")],
    ["an unknown token", merge("EMPLOYEE", "salary")],
    ["an unknown source", merge("VENDOR", "vendor_name")],
  ])("refuses a merge field from %s → 'Unknown merge field'", async (_, f) => {
    const res = await create(token, body({ fields: [f, sig()] }));
    expect(res.body).toEqual(validationBody({ "fields.0.db_column": "mergeFieldUnknown" }));
  });

  it.each(["VENDOR", "CLIENT", "COLLABORATING_COMPANY"])("refuses audience %s → 400 CONTRACT_AUDIENCE_UNSUPPORTED", async (audienceType) => {
    const res = await create(token, body({ audienceType, fields: [sig()] }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_AUDIENCE_UNSUPPORTED"));
  });
});

describe("edit, duplicate, archive and delete", () => {
  let company;
  let token;
  let doc;
  let type;
  const body = (overrides = {}) => ({
    name: "Base",
    audienceType: "EMPLOYEE",
    documentId: doc.id,
    contractTypeId: type.id,
    fields: [merge("EMPLOYEE", "employee_name"), sig()],
    ...overrides,
  });
  const make = async (overrides) => (await create(token, body(overrides))).body.data;

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
    doc = await newDocument(company.employer);
    type = await newType(company.employer);
  });

  it("edits a template used by contracts; the contracts' own fields stay unchanged", async () => {
    const t = await make();
    const contract = await db.Contract.create({ employer_id: company.employer.id, name: "C", template_id: t.id, document_id: doc.id });
    const copy = await db.ContractField.create({ employer_id: company.employer.id, contract_id: contract.id, field_type: "SIGNATURE", page_no: 3, pos_x: 0.2, pos_y: 0.7 });
    const res = await update(token, t.id, body({ name: "Edited", fields: [sig({ pos_x: 0.5 })] }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Edited" });
    expect(res.body.data.fields).toHaveLength(1);
    expect(res.body.data.fields[0].pos_x).toBe(0.5);
    expect(Number((await copy.reload()).pos_x)).toBe(0.2);
  });

  it("changes the audience on edit only when every merge field fits the new one", async () => {
    const t = await make({ fields: [merge("EMPLOYEE", "employee_name"), sig()] });
    const bad = await update(token, t.id, body({ audienceType: "STAFFING_COMPANY", fields: [merge("EMPLOYEE", "employee_name"), sig()] }));
    expect(bad.body).toEqual(validationBody({ "fields.0.db_column": "mergeFieldUnknown" }));
    const ok = await update(token, t.id, body({ audienceType: "STAFFING_COMPANY", fields: [merge("CONTRACT", "contract_no"), sig()] }));
    expect(ok.status).toBe(200);
    expect(ok.body.data.audience_type).toBe("STAFFING_COMPANY");
  });

  it("refuses to edit a template whose document was archived after it was built", async () => {
    const d = await newDocument(company.employer);
    const t = await make({ documentId: d.id });
    await d.update({ status: "ARCHIVED" });
    const res = await update(token, t.id, body({ documentId: d.id }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_DOCUMENT_ARCHIVED"));
  });

  it("duplicates a template as an ACTIVE '<name> (copy)' with the same fields", async () => {
    const t = await make({ name: "Original" });
    const res = await duplicate(token, t.id);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Original (copy)", status: "ACTIVE" });
    const strip = (fields) => fields.map(({ id: _id, ...rest }) => rest);
    expect(strip(res.body.data.fields)).toEqual(strip(t.fields));
  });

  it("archives a template: it leaves the active list and is kept", async () => {
    const t = await make({ name: "To Archive" });
    const res = await setStatus(token, t.id, "ARCHIVED");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ARCHIVED");
    expect((await list(token, { status: "ACTIVE", limit: 100 })).body.data.items.map((i) => i.id)).not.toContain(t.id);
    expect((await get(token, t.id)).status).toBe(200);
  });

  it("unarchives a template; refuses when its document is archived or its type inactive", async () => {
    const d = await newDocument(company.employer);
    const ty = await newType(company.employer);
    const t = await make({ documentId: d.id, contractTypeId: ty.id });
    await setStatus(token, t.id, "ARCHIVED");
    expect((await setStatus(token, t.id, "ACTIVE")).body.data.status).toBe("ACTIVE");
    await setStatus(token, t.id, "ARCHIVED");
    await d.update({ status: "ARCHIVED" });
    expect((await setStatus(token, t.id, "ACTIVE")).body).toEqual(errorBody("CONTRACT_DOCUMENT_ARCHIVED"));
    await d.update({ status: "SAVED" });
    await ty.update({ is_active: false });
    expect((await setStatus(token, t.id, "ACTIVE")).body).toEqual(validationBody({ contractTypeId: "contractTypeRequired" }));
  });

  it("refuses to delete a template used by a contract → 409 CONTRACT_TEMPLATE_IN_USE", async () => {
    const t = await make();
    await db.Contract.create({ employer_id: company.employer.id, name: "C", template_id: t.id });
    const res = await remove(token, t.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_TEMPLATE_IN_USE"));
  });

  it("deletes an unused template", async () => {
    const t = await make({ name: "Disposable" });
    expect((await remove(token, t.id)).status).toBe(200);
    expect((await get(token, t.id)).status).toBe(404);
    expect((await list(token, { search: "Disposable" })).body.data.items).toEqual([]);
  });

  it("lists templates with search, status and audience filters, paginated", async () => {
    const other = await createCompany();
    const otherToken = await ownerToken(other);
    const d = await newDocument(other.employer);
    const ty = await newType(other.employer);
    const mk = (name, audienceType) => create(otherToken, { name, audienceType, documentId: d.id, contractTypeId: ty.id, fields: [sig()] });
    const a = (await mk("Alpha Employment", "EMPLOYEE")).body.data;
    const b = (await mk("Beta Staffing", "STAFFING_COMPANY")).body.data;
    await setStatus(otherToken, b.id, "ARCHIVED");
    const all = await list(otherToken, { limit: 1 });
    expect(all.body.data).toMatchObject({ total: 2, limit: 1 });
    expect((await list(otherToken, { search: "alpha" })).body.data.items.map((i) => i.id)).toEqual([a.id]);
    expect((await list(otherToken, { status: "ARCHIVED" })).body.data.items.map((i) => i.id)).toEqual([b.id]);
    expect((await list(otherToken, { audience: "STAFFING_COMPANY" })).body.data.items.map((i) => i.id)).toEqual([b.id]);
    expect((await list(otherToken, {})).body.data.items[0]).toMatchObject({ field_count: 1 });
    expect((await list(otherToken, {})).body.data.items[0].field_counts).toEqual({ SIGNATURE: 1 });
  });

  it.each(["get", "update", "remove", "duplicate", "setStatus"])("404 for another company's template (%s)", async (action) => {
    const other = await createCompany();
    const d = await newDocument(other.employer);
    const ty = await newType(other.employer);
    const foreign = (await create(await ownerToken(other), { name: "F", audienceType: "EMPLOYEE", documentId: d.id, contractTypeId: ty.id, fields: [sig()] })).body.data;
    const calls = {
      get: () => get(token, foreign.id),
      update: () => update(token, foreign.id, body()),
      remove: () => remove(token, foreign.id),
      duplicate: () => duplicate(token, foreign.id),
      setStatus: () => setStatus(token, foreign.id, "ARCHIVED"),
    };
    const res = await calls[action]();
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });
});

describe("permissions", () => {
  let company;
  let template;
  let doc;
  let type;

  beforeAll(async () => {
    company = await createCompany();
    doc = await newDocument(company.employer);
    type = await newType(company.employer);
    template = (await create(await ownerToken(company), { name: "P", audienceType: "EMPLOYEE", documentId: doc.id, contractTypeId: type.id, fields: [sig()] })).body.data;
  });

  const payload = () => ({ name: `X ${h.short()}`, audienceType: "EMPLOYEE", documentId: doc.id, contractTypeId: type.id, fields: [sig()] });
  const calls = {
    catalogue: (t) => catalogue(t, "EMPLOYEE"),
    list: (t) => list(t),
    get: (t) => get(t, template.id),
    create: (t) => create(t, payload()),
    duplicate: (t) => duplicate(t, template.id),
    update: (t) => update(t, template.id, payload()),
    setStatus: (t) => setStatus(t, template.id, "ACTIVE"),
    remove: (t) => remove(t, "00000000-0000-4000-a000-000000000000"),
  };
  const FLAG = { catalogue: "can_read", list: "can_read", get: "can_read", create: "can_create", duplicate: "can_create", update: "can_update", setStatus: "can_update", remove: "can_delete" };

  it.each(Object.keys(FLAG))("%s: 403 without its flag, allowed with it", async (action) => {
    const others = Object.fromEntries(["can_read", "can_create", "can_update", "can_delete"].filter((f) => f !== FLAG[action]).map((f) => [f, true]));
    const denied = await hrLogin(company.employer, others);
    const res = await calls[action](denied.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    const allowed = await hrLogin(company.employer, { [FLAG[action]]: true });
    expect((await calls[action](allowed.token)).status).not.toBe(403);
  });

  it("403 for the employee and the staffing company", async () => {
    const { user: emp } = await createEmployee(company.employer);
    const { user: staff } = await createStaffingCompany(company.employer);
    for (const user of [emp, staff]) {
      const token = await h.loginAs(user.email);
      for (const call of Object.values(calls)) expect((await call(token)).status).toBe(403);
    }
  });
});

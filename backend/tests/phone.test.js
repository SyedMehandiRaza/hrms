const Joi = require("joi");
const { getExampleNumber } = require("libphonenumber-js/max");
const examples = require("libphonenumber-js/mobile/examples");

const db = require("../src/models");
const { FIELD_MESSAGES } = require("../src/constants/messages");
const { fieldErrorsFromJoi } = require("../src/utils/fieldErrors");
const { toE164, phoneFields, convertExisting } = require("../src/utils/phone");
const { convertPhones } = require("../src/migrations/20261020500004-geo-phones-e164");

// Phone service + data migration (ticket geo#02; countries-cities-phones D15–D21, ADR 0012).

afterAll(async () => {
  await db.sequelize.close();
});

const check = (schema, body) => {
  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  return { errors: fieldErrorsFromJoi(error), value };
};
const text = (key) => FIELD_MESSAGES[key].en;

describe("toE164 (D15–D17)", () => {
  it.each(["0501234567", "50 123 4567", "+966501234567", "+966 50 123 4567", "00966501234567"])(
    "%j with SA → +966501234567",
    (input) => {
      expect(toE164(input, "SA")).toBe("+966501234567");
    }
  );

  it("accepts a fixed line as well as a mobile (Riyadh landline)", () => {
    expect(toE164("011 234 5678", "SA")).toBe("+966112345678");
  });

  it.each([
    ["12345", "SA"],
    ["0501234567", "IN"],
    ["+919876543210", "SA"],
    ["", "SA"],
    ["0501234567", "ZZ"],
    ["0501234567", null],
  ])("%j with %j → null", (input, iso2) => {
    expect(toE164(input, iso2)).toBeNull();
  });

  it("keeps the US and Canada apart although both are +1", () => {
    const us = getExampleNumber("US", examples).number;
    const ca = getExampleNumber("CA", examples).number;
    expect(toE164(us, "US")).toBe(us);
    expect(toE164(ca, "CA")).toBe(ca);
    expect(toE164(us, "CA")).toBeNull();
    expect(toE164(ca, "US")).toBeNull();
  });
});

describe("phoneFields (shared validator)", () => {
  const required = Joi.object({ ...phoneFields() });
  const optional = Joi.object({ ...phoneFields({ required: false }) });

  it("outputs E.164 and an uppercased country", () => {
    const { errors, value } = check(required, { phone: "050 123 4567", phoneCountry: "sa" });
    expect(errors).toEqual({});
    expect(value).toEqual({ phone: "+966501234567", phoneCountry: "SA" });
  });

  it("an invalid number → phone 'Enter a valid phone number for the selected country.'", () => {
    expect(check(required, { phone: "12345", phoneCountry: "SA" }).errors).toEqual({ phone: "phoneInvalidForCountry" });
    expect(text("phoneInvalidForCountry")).toBe("Enter a valid phone number for the selected country.");
  });

  it("no phone country → phoneCountry 'Select the phone number's country.' (and only that)", () => {
    expect(check(required, { phone: "0501234567" }).errors).toEqual({ phoneCountry: "phoneCountryRequired" });
    expect(text("phoneCountryRequired")).toBe("Select the phone number's country.");
  });

  it.each(["ZZ", "XX", "S", "SAU", 12])("an unknown country %j → the same phoneCountry message", (phoneCountry) => {
    expect(check(required, { phone: "0501234567", phoneCountry }).errors).toEqual({ phoneCountry: "phoneCountryRequired" });
  });

  it("a missing or blank phone → the configured 'required' text", () => {
    expect(check(required, { phoneCountry: "SA" }).errors).toEqual({ phone: "phoneNumberRequired" });
    expect(check(required, { phone: "  ", phoneCountry: "SA" }).errors).toEqual({ phone: "phoneNumberRequired" });
    const custom = Joi.object({ ...phoneFields({ requiredKey: "phoneRequired" }) });
    expect(check(custom, { phoneCountry: "SA" }).errors).toEqual({ phone: "phoneRequired" });
  });

  it("a non-string phone → the invalid-number text", () => {
    expect(check(required, { phone: 501234567, phoneCountry: "SA" }).errors).toEqual({ phone: "phoneInvalidForCountry" });
  });

  it("optional: nothing given is fine; a phone without a country is not", () => {
    expect(check(optional, {}).errors).toEqual({});
    expect(check(optional, { phone: "", phoneCountry: "" }).errors).toEqual({});
    expect(check(optional, { phone: null, phoneCountry: null }).errors).toEqual({});
    expect(check(optional, { phone: "0501234567" }).errors).toEqual({ phoneCountry: "phoneCountryRequired" });
    expect(check(optional, { phone: "0501234567", phoneCountry: "SA" }).value).toEqual({
      phone: "+966501234567",
      phoneCountry: "SA",
    });
  });

  it("custom key names", () => {
    const schema = Joi.object({ ...phoneFields({ phoneKey: "contactPhone", countryKey: "contactPhoneCountry" }) });
    expect(check(schema, { contactPhone: "12", contactPhoneCountry: "SA" }).errors).toEqual({ contactPhone: "phoneInvalidForCountry" });
  });
});

describe("convertExisting (D21)", () => {
  it.each([
    ["+966500000001", "+966500000001", "SA"],
    ["0501234567", "+966501234567", "SA"],
    ["501234567", "+966501234567", "SA"],
    ["+91 98765 43210", "+919876543210", "IN"],
  ])("%j → %s (%s)", (input, e164, country) => {
    expect(convertExisting(input)).toEqual({ e164, country });
  });

  it.each(["12345", "abc", "", null, "+999123"])("%j can't be converted", (input) => {
    expect(convertExisting(input)).toBeNull();
  });
});

describe("the data migration", () => {
  const uniq = () => Math.random().toString(36).slice(2, 10);

  it("converts valid values, leaves the rest with no country, and reports them", async () => {
    const owner = await db.User.create({ name: "Owner", email: `ph-${uniq()}@hrms.test`, phone_number: "0551112233" });
    const employer = await db.Employer.create({
      user_id: owner.id,
      company_name: "Phone Co",
      employer_status: "ACTIVE",
      company_phone_number: "011 234 5678",
    });
    const office = await db.Office.create({ employer_id: employer.id, office_name: `HQ ${uniq()}`, office_phone: "not a phone" });
    const staffing = await db.StaffingCompany.create({
      employer_id: employer.id,
      name: "Supply Co",
      phone: "+91 98765 43210",
      contact_person_phone: "12",
    });

    const { report } = await db.sequelize.transaction((transaction) => convertPhones(db.sequelize, transaction));

    await Promise.all([owner, employer, office, staffing].map((row) => row.reload()));
    expect([owner.phone_number, owner.phone_country]).toEqual(["+966551112233", "SA"]);
    expect([employer.company_phone_number, employer.phone_country]).toEqual(["+966112345678", "SA"]);
    expect([staffing.phone, staffing.phone_country]).toEqual(["+919876543210", "IN"]);
    expect([office.office_phone, office.phone_country]).toEqual(["not a phone", null]);
    expect([staffing.contact_person_phone, staffing.contact_person_phone_country]).toEqual(["12", null]);
    expect(report).toEqual(
      expect.arrayContaining([
        { table: "offices", id: office.id, column: "office_phone", value: "not a phone", reason: "not a valid number" },
        { table: "hrms_staffing_companies", id: staffing.id, column: "contact_person_phone", value: "12", reason: "not a valid number" },
      ])
    );
  });

  it("never gives two people the same number: the clash is reported, not overwritten", async () => {
    const first = await db.User.create({ name: "First", email: `a-${uniq()}@hrms.test`, phone_number: "+966561234567", phone_country: "SA" });
    const second = await db.User.create({ name: "Second", email: `b-${uniq()}@hrms.test`, phone_number: "0561234567" });

    const { report } = await db.sequelize.transaction((transaction) => convertPhones(db.sequelize, transaction));

    await second.reload();
    expect(second.phone_number).toBe("0561234567");
    expect(second.phone_country).toBeNull();
    expect(report).toContainEqual({
      table: "users",
      id: second.id,
      column: "phone_number",
      value: "0561234567",
      reason: `same number as user ${first.id}`,
    });
  });

  it("leaves already-converted rows alone (re-running changes nothing)", async () => {
    const user = await db.User.create({ name: "Done", email: `d-${uniq()}@hrms.test`, phone_number: "+966571234567", phone_country: "SA" });
    await db.sequelize.transaction((transaction) => convertPhones(db.sequelize, transaction));
    const { report } = await db.sequelize.transaction((transaction) => convertPhones(db.sequelize, transaction));
    await user.reload();
    expect(user.phone_number).toBe("+966571234567");
    expect(report.find((r) => r.id === user.id)).toBeUndefined();
  });
});

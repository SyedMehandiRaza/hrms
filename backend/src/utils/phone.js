const Joi = require("joi");
const { parsePhoneNumberFromString, getCountries } = require("libphonenumber-js/max");

// Phone numbers (docs/plans/countries-cities-phones.md D15–D21, ADR 0012): stored as E.164
// (+966501234567) with the phone country's ISO-2 code. A number is valid when libphonenumber
// says it's a valid number (mobile or fixed line) of exactly that country.

const PHONE_COUNTRIES = new Set(getCountries());

const isPhoneCountry = (iso2) => PHONE_COUNTRIES.has(String(iso2 || "").trim().toUpperCase());

// "0501234567" / "50 123 4567" / "+966501234567" with "SA" → "+966501234567"; anything that
// isn't a valid number of that country → null.
const toE164 = (text, iso2) => {
  const country = String(iso2 || "").trim().toUpperCase();
  if (!PHONE_COUNTRIES.has(country) || typeof text !== "string" || !text.trim()) return null;
  const parsed = parsePhoneNumberFromString(text.trim(), country);
  if (!parsed || !parsed.isValid() || parsed.country !== country) return null;
  return parsed.number;
};

// Joi rules for a { phone, phoneCountry } pair (keys configurable), to spread into a Joi.object:
//   Joi.object({ ...phoneFields({ required: true, requiredKey: "phoneRequired" }) })
// The phone is checked against its sibling country and comes out as E.164; the country comes
// out uppercased. When the country itself is missing or unknown only the country is reported.
// An optional pair ("" or null for both) means "no phone"; a phone without a country is refused.
const phoneFields = ({
  phoneKey = "phone",
  countryKey = "phoneCountry",
  required = true,
  requiredKey = "phoneNumberRequired",
} = {}) => {
  let phone = Joi.string()
    .trim()
    .custom((value, helpers) => {
      const country = helpers.state.ancestors[0][countryKey];
      if (!isPhoneCountry(country)) return value; // reported on the country field
      return toE164(value, country) || helpers.error("phone.invalid");
    })
    .messages({ "string.base": "phoneInvalidForCountry", "phone.invalid": "phoneInvalidForCountry" });
  phone = required
    ? phone.required().messages({ "any.required": requiredKey, "string.empty": requiredKey })
    : phone.empty(["", null]);

  let country = Joi.string()
    .trim()
    .uppercase()
    .custom((value, helpers) => (isPhoneCountry(value) ? value : helpers.error("phoneCountry.invalid")))
    .messages({ "string.base": "phoneCountryRequired", "phoneCountry.invalid": "phoneCountryRequired" });
  country = required
    ? country.required().messages({ "any.required": "phoneCountryRequired", "string.empty": "phoneCountryRequired" })
    : country.empty(["", null]).when(phoneKey, {
        is: Joi.exist(),
        then: Joi.required().messages({ "any.required": "phoneCountryRequired" }),
      });

  return { [phoneKey]: phone, [countryKey]: country };
};

// Existing phone values (D21): a value with a + code is parsed as an international number,
// one without as a Saudi number. Returns { e164, country } or null when it can't be parsed
// into a valid number.
const convertExisting = (text, defaultCountry = "SA") => {
  if (typeof text !== "string" || !text.trim()) return null;
  const parsed = parsePhoneNumberFromString(text.trim(), text.trim().startsWith("+") ? undefined : defaultCountry);
  if (!parsed || !parsed.isValid() || !parsed.country) return null;
  return { e164: parsed.number, country: parsed.country };
};

module.exports = { toE164, isPhoneCountry, phoneFields, convertExisting, PHONE_COUNTRIES };

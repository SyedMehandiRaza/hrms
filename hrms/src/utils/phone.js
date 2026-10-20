import { parsePhoneNumberFromString } from "libphonenumber-js/max";

// Phone numbers (docs/plans/countries-cities-phones.md D15–D19, ADR 0012). The server stores
// E.164 (+966501234567) with the phone country; the form shows the phone country's code in its
// own picker and the rest of the number next to it ("+966" | "50 123 4567").

// The company country is Saudi Arabia for every company for now (D11): the default before
// /auth/me is known (sign-up).
export const DEFAULT_PHONE_COUNTRY = "SA";

// Same rule as the server: a valid number (mobile or fixed line) of exactly that country.
export const isValidPhone = (text, iso2) => {
  if (!text || !iso2) return false;
  const parsed = parsePhoneNumberFromString(String(text).trim(), iso2);
  return Boolean(parsed && parsed.isValid() && parsed.country === iso2);
};

// "+966501234567" → "50 123 4567" (international format without the calling code), for the input
// next to the code picker. A value that isn't E.164 is shown as it is.
export const phoneForInput = (e164) => {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(String(e164));
  if (!parsed) return String(e164);
  return parsed.formatInternational().replace(`+${parsed.countryCallingCode}`, "").trim();
};

// "+966501234567" → "+966 50 123 4567", for read-only display.
export const formatPhone = (e164) => {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(String(e164));
  return parsed ? parsed.formatInternational() : String(e164);
};

// react-hook-form rule for a phone input whose phone country is another field.
//   register("phone", { validate: phoneRule(() => getValues("phoneCountry"), t, { required }) })
export const phoneRule =
  (getCountry, t, { required = false, requiredMessage } = {}) =>
  (value) => {
    const text = typeof value === "string" ? value.trim() : value;
    if (!text) return required ? requiredMessage : true;
    const country = getCountry();
    if (!country) return true; // reported on the phone-country field
    return isValidPhone(text, country) || t("common:geo.phoneInvalid");
  };
